use crate::{
    AppState,
    commands::server::start_server_with_origin,
    core::models::{config_for_id, installed_ids},
};
use serde::Deserialize;
use std::{
    sync::atomic::Ordering,
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Deserialize)]
struct JITAction {
    #[serde(rename = "type")]
    kind: String,
    model_id: String,
}

fn endpoint(app: &tauri::AppHandle) -> Option<(String, String)> {
    let state = app.state::<AppState>();
    if state.shutting_down.load(Ordering::Acquire) {
        return None;
    }
    let mut gateway = state.gateway.lock().ok()?;
    let (port, token) = gateway.control_endpoint()?;
    Some((format!("http://127.0.0.1:{port}/_tidestudio/jit"), token))
}

fn control_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())
}

pub(crate) fn report_failure(app: &tauri::AppHandle, id: &str, error: &str) {
    if let Some((url, token)) = endpoint(app) {
        if let Ok(client) = control_client() {
            let _ = client.post(format!("{url}/fail"))
                .header("X-TideStudio-Control-Token", token)
                .json(&serde_json::json!({"model_id": id, "error": error}))
                .send();
        }
    }
}

pub(crate) fn sync_catalog(app: &tauri::AppHandle) {
    let Some((url, token)) = endpoint(app) else {
        return;
    };
    let Ok(ids) = installed_ids() else {
        return;
    };
    if let Ok(client) = control_client() {
        let _ = client.put(format!("{url}/models"))
            .header("X-TideStudio-Control-Token", token)
            .json(&ids)
            .send();
    }
}

fn unload(app: &tauri::AppHandle, id: &str) {
    let port = {
        let state = app.state::<AppState>();
        let Ok(servers) = state.servers.lock() else {
            return;
        };
        servers.jit_port(id)
    };
    if let Some(port) = port {
        if let Err(error) = tauri::async_runtime::block_on(
            crate::commands::server::stop_server(app.clone(), port)
        ) {
            report_failure(app, id, &error);
        } else {
            let _ = app.emit("server-jit-unloaded", id);
        }
    }
}

fn load(app: &tauri::AppHandle, id: &str) {
    let result = config_for_id(id).and_then(|config| {
        tauri::async_runtime::block_on(start_server_with_origin(app.clone(), config, true))
    });
    if let Err(error) = result {
        report_failure(app, id, &error);
    } else {
        let _ = app.emit("server-jit-loaded", id);
    }
}

/// Polling is local, authenticated and independent from the desktop WebView.
/// A gateway restart resets its transient JIT queue and model catalog.
pub(crate) fn start_controller(app: tauri::AppHandle) {
    thread::spawn(move || {
        let Ok(client) = control_client() else {
            return;
        };
        let mut last_catalog = Instant::now() - Duration::from_secs(30);
        let mut last_endpoint = String::new();
        loop {
            if app
                .state::<AppState>()
                .shutting_down
                .load(Ordering::Acquire)
            {
                break;
            }
            let Some((url, token)) = endpoint(&app) else {
                last_endpoint.clear();
                thread::sleep(Duration::from_millis(250));
                continue;
            };
            if last_endpoint != url || last_catalog.elapsed() >= Duration::from_secs(10) {
                sync_catalog(&app);
                last_catalog = Instant::now();
                last_endpoint = url.clone();
            }

            if let Ok(response) = client.get(format!("{url}/actions"))
                .header("X-TideStudio-Control-Token", token)
                .send()
            {
                if response.status().is_success() {
                    if let Ok(action) = response.json::<JITAction>() {
                        if app
                            .state::<AppState>()
                            .shutting_down
                            .load(Ordering::Acquire)
                        {
                            break;
                        }
                        match action.kind.as_str() {
                            "load" => load(&app, &action.model_id),
                            "unload" => unload(&app, &action.model_id),
                            _ => {}
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
    });
}
