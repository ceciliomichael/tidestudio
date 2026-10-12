use crate::{
    AppState,
    core::{
        config::{InferenceDefaults, ServerConfig},
        gateway::GatewayConfig,
        models::model_id,
        servers::{ServerLifecycle, ServerStatus},
    },
};
use serde::Serialize;
use std::{net::TcpListener, sync::atomic::Ordering, time::Duration};
use tauri::{Emitter, Manager};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerStartFailure {
    port: u16,
    model_id: String,
    model_path: String,
    error: String,
}

fn allocate_worker_port(public_port: u16) -> Result<u16, String> {
    for _ in 0..16 {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("cannot allocate worker port: {e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        if port != public_port {
            return Ok(port);
        }
    }
    Err("failed to allocate a private worker port".into())
}

fn worker_is_ready(client: &reqwest::blocking::Client, status: &ServerStatus) -> bool {
    let base_url = format!("http://127.0.0.1:{}", status.port);
    let healthy = client
        .get(format!("{base_url}/health"))
        .send()
        .is_ok_and(|response| response.status() == reqwest::StatusCode::OK);
    if !healthy {
        return false;
    }

    client
        .get(format!("{base_url}/v1/models"))
        .send()
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.json::<serde_json::Value>())
        .ok()
        .and_then(|body| body.get("data")?.as_array().cloned())
        .is_some_and(|models| {
            models.iter().any(|model| {
                model.get("id").and_then(|id| id.as_str()) == Some(status.model_id.as_str())
            })
        })
}

fn finish_server_start(
    app: &tauri::AppHandle,
    loading_status: &ServerStatus,
) -> Result<Option<ServerStatus>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(500))
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())?;
    let deadline = std::time::Instant::now() + Duration::from_secs(120);

    while std::time::Instant::now() < deadline {
        let process_running = {
            let state = app.state::<AppState>();
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            if !servers.matches_model(loading_status.port, &loading_status.model_id) {
                return Ok(None);
            }
            servers.process_running(loading_status.port)?
        };

        match process_running {
            Some(true) => {}
            Some(false) => {
                return Err(format!(
                    "llama.cpp worker exited while loading: {}",
                    loading_status.model_id
                ));
            }
            None => return Ok(None),
        }

        if worker_is_ready(&client, loading_status) {
            // Register the model before publishing Ready, so an API request
            // cannot race the gateway's worker registration.
            register_ready_worker(app, loading_status)?;

            let state = app.state::<AppState>();
            let ready_status = {
                let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
                if !servers.matches_model(loading_status.port, &loading_status.model_id) {
                    return Ok(None);
                }
                if servers.process_running(loading_status.port)? != Some(true) {
                    return Err(format!(
                        "llama.cpp worker exited while loading: {}",
                        loading_status.model_id
                    ));
                }
                servers.mark_ready(loading_status.port)?
            };

            return Ok(Some(ready_status));
        }

        std::thread::sleep(Duration::from_millis(100));
    }

    Err(format!(
        "llama.cpp worker readiness timed out: {}",
        loading_status.model_id
    ))
}

fn cleanup_failed_start(app: &tauri::AppHandle, loading_status: &ServerStatus, error: String) {
    let state = app.state::<AppState>();
    let was_jit = {
        let Ok(mut servers) = state.servers.lock() else {
            return;
        };
        if !servers.matches_model(loading_status.port, &loading_status.model_id) {
            return;
        }
        let was_jit = servers.is_jit(loading_status.port);
        let _ = servers.stop(loading_status.port);
        was_jit
    };

    if was_jit {
        crate::commands::jit::report_failure(app, &loading_status.model_id, &error);
    }
    let unregister_app = app.clone();
    let model_id = loading_status.model_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = unregister_app.state::<AppState>();
        if let Ok(gateway) = state.gateway.lock() {
            let _ = gateway.unregister(&model_id);
        }
    });

    let _ = app.emit(
        "server-start-failed",
        ServerStartFailure {
            port: loading_status.port,
            model_id: loading_status.model_id.clone(),
            model_path: loading_status.model_path.clone(),
            error,
        },
    );
}

fn configure_gateway_now(app: &tauri::AppHandle, config: GatewayConfig) -> Result<(), String> {
    let state = app.state::<AppState>();

    {
        let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
        if state.shutting_down.load(Ordering::Acquire) {
            return Err("TideStudio is shutting down".to_string());
        }
        gateway.start(config.clone())?;
    }

    *state
        .gateway_port
        .lock()
        .map_err(|_| "gateway port lock poisoned")? = config.port;

    let health_client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(250))
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())?;
    let health_url = format!("http://127.0.0.1:{}/health", config.port);
    let api_key = if config.api_key_enabled {
        config.api_key.as_str()
    } else {
        ""
    };
    let deadline = std::time::Instant::now() + Duration::from_secs(8);

    loop {
        let process_running = {
            let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
            if !gateway.matches_config(&config) {
                return Ok(());
            }
            gateway.is_running()
        };

        if !process_running {
            return Err("API gateway exited during startup".to_string());
        }

        let healthy = health_client
            .get(&health_url)
            .header("Authorization", format!("Bearer {api_key}"))
            .send()
            .is_ok_and(|response| response.status().is_success());
        if healthy {
            break;
        }

        if std::time::Instant::now() >= deadline {
            let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
            if gateway.matches_config(&config) {
                gateway.shutdown();
            }
            return Err("API gateway startup timed out".to_string());
        }

        std::thread::sleep(Duration::from_millis(100));
    }

    let workers = {
        let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
        servers
            .list()?
            .into_iter()
            .filter(|status| status.running && status.state == ServerLifecycle::Ready)
            .filter_map(|status| {
                servers.inference_defaults(status.port).map(|defaults| {
                    let jit = servers.is_jit(status.port);
                    (status, defaults, jit)
                })
            })
            .collect::<Vec<_>>()
    };

    let gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
    for (worker, defaults, jit) in workers {
        gateway.register(&worker.model_id, worker.port, &defaults, jit)?;
    }
    let sync_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || crate::commands::jit::sync_catalog(&sync_app));

    Ok(())
}

fn register_ready_worker(app: &tauri::AppHandle, status: &ServerStatus) -> Result<(), String> {
    let state = app.state::<AppState>();
    let (defaults, jit) = {
        let servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
        let defaults = servers
            .inference_defaults(status.port)
            .ok_or_else(|| "missing worker inference defaults".to_string())?;
        (defaults, servers.is_jit(status.port))
    };

    let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
    if gateway.is_running() {
        gateway.register(&status.model_id, status.port, &defaults, jit)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn configure_gateway(app: tauri::AppHandle, config: GatewayConfig) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || configure_gateway_now(&app, config))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn configure_gateway_background(
    app: tauri::AppHandle,
    config: GatewayConfig,
) -> Result<(), String> {
    if config.api_key_enabled && config.api_key.trim().is_empty() {
        return Err("authentication requires an API key".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let result = configure_gateway_now(&app, config);
        let _ = app.emit("gateway-status-changed", result.is_ok());
        if let Err(error) = result {
            let _ = app.emit("gateway-start-failed", error);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn gateway_status(app: tauri::AppHandle) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
        Ok(gateway.is_running())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn start_server(
    app: tauri::AppHandle,
    config: ServerConfig,
) -> Result<ServerStatus, String> {
    start_server_with_origin(app, config, false).await
}

pub(crate) async fn start_server_with_origin(
    app: tauri::AppHandle,
    mut config: ServerConfig,
    jit: bool,
) -> Result<ServerStatus, String> {
    let spawn_app = app.clone();
    let (status, needs_readiness) = tauri::async_runtime::spawn_blocking(move || {
        let state = spawn_app.state::<AppState>();

        if state.shutting_down.load(Ordering::Acquire) {
            return Err("TideStudio is shutting down".to_string());
        }

        config.model_id = model_id(&config.model_path)?;

        {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            if let Some(existing) = servers
                .list()?
                .into_iter()
                .find(|status| status.running && status.model_id == config.model_id)
            {
                if existing.model_path != config.model_path {
                    return Err(format!(
                        "model ID '{}' is already in use by another GGUF; use unique filenames",
                        config.model_id
                    ));
                }
                if !jit {
                    servers.make_manual(existing.port);
                }
                return Ok((existing, false));
            }
        }

        let public_port = *state
            .gateway_port
            .lock()
            .map_err(|_| "gateway port lock poisoned")?;
        let mut last_error = String::new();

        for _ in 0..5 {
            config.port = allocate_worker_port(public_port)?;
            let result = {
                let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
                if state.shutting_down.load(Ordering::Acquire) {
                    return Err("TideStudio is shutting down".to_string());
                }
                servers.spawn_with_origin(config.clone(), jit)
            };
            match result {
                Ok(status) => return Ok((status, true)),
                Err(error) => last_error = error,
            }
        }

        Err(last_error)
    })
    .await
    .map_err(|error| error.to_string())??;

    if !needs_readiness && status.state == ServerLifecycle::Ready {
        let update_app = app.clone();
        let current = status.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _ = register_ready_worker(&update_app, &current);
        });
    }

    if needs_readiness {
        let readiness_app = app.clone();
        let loading_status = status.clone();
        tauri::async_runtime::spawn_blocking(move || {
            match finish_server_start(&readiness_app, &loading_status) {
                Ok(Some(ready_status)) => {
                    let _ = readiness_app.emit("server-status-changed", ready_status.clone());
                }
                Ok(None) => {}
                Err(error) => cleanup_failed_start(&readiness_app, &loading_status, error),
            }
        });
    }

    Ok(status)
}

#[tauri::command]
pub async fn stop_server(app: tauri::AppHandle, port: u16) -> Result<ServerStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let status = {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            servers.stop(port)?
        };

        let unregister_app = app.clone();
        let model_id = status.model_id.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let state = unregister_app.state::<AppState>();
            if let Ok(gateway) = state.gateway.lock() {
                let _ = gateway.unregister(&model_id);
            }
        });

        Ok(status)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn update_server_inference(
    app: tauri::AppHandle,
    port: u16,
    defaults: InferenceDefaults,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let status = {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            let status = servers
                .status(port)?
                .ok_or_else(|| format!("no TideStudio server is registered on port {port}"))?;
            servers.set_inference_defaults(port, defaults.clone())?;
            status
        };

        if status.running && status.state == ServerLifecycle::Ready {
            let registration_app = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let _ = register_ready_worker(&registration_app, &status);
            });
        }

        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn list_servers(app: tauri::AppHandle) -> Result<Vec<ServerStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let statuses = {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            servers.list()?
        };

        if statuses.iter().any(|status| !status.running) {
            let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
            if gateway.is_running() {
                for stopped in statuses.iter().filter(|status| !status.running) {
                    let _ = gateway.unregister(&stopped.model_id);
                }
            }
        }
        Ok(statuses)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn server_status(
    app: tauri::AppHandle,
    port: u16,
) -> Result<Option<ServerStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
        servers.status(port)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn server_logs(app: tauri::AppHandle, port: u16) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
        Ok(servers.logs(port))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};

    fn probe_mock_worker(health_ok: bool, response_model_id: &str) -> bool {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test worker");
        let port = listener.local_addr().expect("test worker address").port();
        let models_body = format!(r#"{{"data":[{{"id":"{response_model_id}"}}]}}"#);
        let requests = if health_ok { 2 } else { 1 };

        let server = std::thread::spawn(move || {
            for _ in 0..requests {
                let (mut stream, _) = listener.accept().expect("accept readiness probe");
                let mut request_line = String::new();
                BufReader::new(stream.try_clone().expect("clone stream"))
                    .read_line(&mut request_line)
                    .expect("read readiness probe");

                let (status, body) = if request_line.starts_with("GET /health ") {
                    if health_ok {
                        ("200 OK", r#"{"status":"ok"}"#)
                    } else {
                        ("503 Service Unavailable", r#"{"status":"loading model"}"#)
                    }
                } else {
                    assert!(request_line.starts_with("GET /v1/models "));
                    ("200 OK", models_body.as_str())
                };

                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .expect("write readiness response");
            }
        });

        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("test client");
        let status = ServerStatus {
            backend: "llama.cpp".to_string(),
            runtime_id: "llama-cuda".to_string(),
            runtime_fallback: None,
            model_path: "test.gguf".to_string(),
            model_id: "test-model".to_string(),
            model_name: "Test".to_string(),
            model_category: "LLM".to_string(),
            quantization: "F16".to_string(),
            supports_mtp: false,
            supports_vision: false,
            supports_tools: false,
            port,
            pid: std::process::id(),
            memory_bytes: 0,
            running: true,
            state: ServerLifecycle::Loading,
        };

        let ready = worker_is_ready(&client, &status);
        server.join().expect("test worker completed");
        ready
    }

    #[test]
    fn loading_health_never_reports_ready_even_with_model_listed() {
        assert!(!probe_mock_worker(false, "test-model"));
    }

    #[test]
    fn healthy_worker_must_expose_the_requested_model() {
        assert!(!probe_mock_worker(true, "another-model"));
        assert!(probe_mock_worker(true, "test-model"));
    }
}
