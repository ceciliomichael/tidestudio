use crate::{
    AppState,
    core::models::{
        ModelInfo, delete_managed_model, discover_models, load_model_settings as load_settings,
        save_model_settings as save_settings,
    },
};
use serde_json::Value;
use tauri::Manager;

#[tauri::command]
pub async fn list_models() -> Result<Vec<ModelInfo>, String> {
    tauri::async_runtime::spawn_blocking(discover_models)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn load_model_settings(model_path: String) -> Result<Option<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || load_settings(&model_path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_model_settings(model_path: String, settings: Value) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || save_settings(&model_path, &settings))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn delete_model(app: tauri::AppHandle, model_path: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
    if servers.contains_model_path(&model_path) {
        return Err("stop the model before deleting it".to_string());
    }
    drop(servers);

    delete_managed_model(&model_path)
}
