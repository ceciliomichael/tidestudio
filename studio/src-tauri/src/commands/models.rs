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
pub fn list_models() -> Result<Vec<ModelInfo>, String> {
    discover_models()
}

#[tauri::command]
pub fn load_model_settings(model_path: String) -> Result<Option<Value>, String> {
    load_settings(&model_path)
}

#[tauri::command]
pub fn save_model_settings(model_path: String, settings: Value) -> Result<(), String> {
    save_settings(&model_path, &settings)
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
