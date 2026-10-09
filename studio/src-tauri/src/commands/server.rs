use crate::{
    AppState,
    core::{
        config::{InferenceDefaults, ServerConfig},
        gateway::GatewayConfig,
        models::resolve_models_dir,
        servers::{ServerLifecycle, ServerStatus},
    },
};
use serde::Serialize;
use std::{net::TcpListener, path::Path, time::Duration};
use tauri::{Emitter, Manager, State};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerStartFailure {
    port: u16,
    model_id: String,
    model_path: String,
    error: String,
}

fn public_model_id(path: &str) -> Result<String, String> {
    let root = resolve_models_dir()?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    let relative = file
        .strip_prefix(&root)
        .map_err(|_| "model must be in the managed models directory".to_string())?;
    let id = relative.to_string_lossy().replace('\\', "/");
    Ok(id.strip_suffix(".gguf").unwrap_or(&id).to_string())
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
    let url = format!("http://127.0.0.1:{}/v1/models", status.port);
    client
        .get(url)
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
            let state = app.state::<AppState>();
            let defaults = {
                let servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
                if !servers.matches_model(loading_status.port, &loading_status.model_id) {
                    return Ok(None);
                }
                servers
                    .inference_defaults(loading_status.port)
                    .ok_or_else(|| "missing worker inference defaults".to_string())?
            };

            {
                let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
                if !gateway.is_running() {
                    return Err("API gateway stopped while the model was loading.".into());
                }
                gateway.register(&loading_status.model_id, loading_status.port, &defaults)?;
            }

            let ready_status = {
                let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
                if !servers.matches_model(loading_status.port, &loading_status.model_id) {
                    drop(servers);
                    let gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
                    let _ = gateway.unregister(&loading_status.model_id);
                    return Ok(None);
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
    let should_unregister = {
        let Ok(mut servers) = state.servers.lock() else {
            return;
        };
        if !servers.matches_model(loading_status.port, &loading_status.model_id) {
            return;
        }
        let _ = servers.stop(loading_status.port);
        true
    };

    if should_unregister {
        if let Ok(gateway) = state.gateway.lock() {
            let _ = gateway.unregister(&loading_status.model_id);
        }
    }

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

#[tauri::command]
pub async fn configure_gateway(app: tauri::AppHandle, config: GatewayConfig) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let workers = {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            let statuses = servers
                .list()?
                .into_iter()
                .filter(|status| status.running && status.state == ServerLifecycle::Ready)
                .collect::<Vec<_>>();
            statuses
                .into_iter()
                .filter_map(|status| {
                    servers
                        .inference_defaults(status.port)
                        .map(|defaults| (status, defaults))
                })
                .collect::<Vec<_>>()
        };

        let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
        gateway.ensure(config.clone())?;
        *state
            .gateway_port
            .lock()
            .map_err(|_| "gateway port lock poisoned")? = config.port;
        for (worker, defaults) in workers {
            gateway.register(&worker.model_id, worker.port, &defaults)?;
        }
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn gateway_status(state: State<'_, AppState>) -> Result<bool, String> {
    let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
    Ok(gateway.is_running())
}

#[tauri::command]
pub async fn start_server(
    app: tauri::AppHandle,
    mut config: ServerConfig,
) -> Result<ServerStatus, String> {
    let spawn_app = app.clone();
    let (status, needs_readiness) = tauri::async_runtime::spawn_blocking(move || {
        let state = spawn_app.state::<AppState>();

        {
            let mut gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
            if !gateway.is_running() {
                return Err("API gateway is not running. Apply Server Settings first.".into());
            }
        }

        config.model_id = public_model_id(&config.model_path)?;

        {
            let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
            if let Some(existing) = servers
                .list()?
                .into_iter()
                .find(|status| status.running && status.model_id == config.model_id)
            {
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
                servers.spawn(config.clone())
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

    if needs_readiness {
        let readiness_app = app.clone();
        let loading_status = status.clone();
        tauri::async_runtime::spawn_blocking(move || {
            match finish_server_start(&readiness_app, &loading_status) {
                Ok(Some(ready_status)) => {
                    let _ = readiness_app.emit("server-status-changed", ready_status);
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

        let gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
        let unregister_error = gateway.unregister(&status.model_id).err();
        if let Some(error) = unregister_error {
            return Err(format!(
                "worker stopped, but gateway unregister failed: {error}"
            ));
        }

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
            let gateway = state.gateway.lock().map_err(|_| "gateway lock poisoned")?;
            gateway.register(&status.model_id, status.port, &defaults)?;
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
