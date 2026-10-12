use crate::{
    AppState,
    core::runtimes::{
        RuntimeInfo, RuntimePreferences, cancel_install, get_preferences, install_runtime,
        list_runtimes, remove_runtime, set_preference,
    },
};
use tauri::Manager;

#[tauri::command]
pub async fn get_runtimes() -> Result<Vec<RuntimeInfo>, String> {
    tauri::async_runtime::spawn_blocking(list_runtimes)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn get_runtime_preferences() -> Result<RuntimePreferences, String> {
    get_preferences()
}

#[tauri::command]
pub async fn set_preferred_runtime(
    app: tauri::AppHandle,
    engine: String,
    id: String,
) -> Result<RuntimePreferences, String> {
    tauri::async_runtime::spawn_blocking(move || set_preference(&app, &engine, &id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn install_inference_runtime(app: tauri::AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || install_runtime(&app, &id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn cancel_inference_runtime_install(id: String) -> Result<(), String> {
    cancel_install(&id)
}

#[tauri::command]
pub async fn remove_inference_runtime(app: tauri::AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        // Keep new loads from racing deletion of a runtime's binaries.
        let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
        if servers
            .list()?
            .iter()
            .any(|server| server.running && server.runtime_id == id)
        {
            return Err("Stop all models using this runtime before removing it".to_string());
        }
        remove_runtime(&id)
    })
    .await
    .map_err(|error| error.to_string())?
}
