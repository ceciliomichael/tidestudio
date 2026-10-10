use crate::{
    AppState,
    commands::preferences::{delete_ui_preference_sync, set_ui_preference_sync},
    core::models::{
        ModelInfo, delete_managed_model, discover_models, load_model_settings as load_settings,
        save_model_settings as save_settings,
    },
    core::paths::{
        MODEL_STORAGE_PREFERENCE_KEY, default_models_dir, display_path, resolve_models_dir,
        set_models_dir,
    },
};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsDirectoryInfo {
    pub path: String,
    pub default_path: String,
    pub is_default: bool,
}

fn directory_info() -> Result<ModelsDirectoryInfo, String> {
    let path = resolve_models_dir()?;
    let default = default_models_dir()?;
    Ok(ModelsDirectoryInfo {
        is_default: path == default || path.canonicalize().ok() == default.canonicalize().ok(),
        path: display_path(&path),
        default_path: display_path(&default),
    })
}

fn ensure_no_running_models(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut servers = state.servers.lock().map_err(|_| "server lock poisoned")?;
    if servers.list()?.iter().any(|server| server.running) {
        return Err("stop loaded models before changing the models directory".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn get_models_directory() -> Result<ModelsDirectoryInfo, String> {
    directory_info()
}

#[tauri::command]
pub fn set_models_directory(
    app: tauri::AppHandle,
    path: String,
) -> Result<ModelsDirectoryInfo, String> {
    ensure_no_running_models(&app)?;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("choose a models directory".to_string());
    }
    let selected = set_models_dir(PathBuf::from(trimmed))?;
    set_ui_preference_sync(&app, MODEL_STORAGE_PREFERENCE_KEY, &display_path(&selected))?;
    directory_info()
}

#[tauri::command]
pub fn reset_models_directory(app: tauri::AppHandle) -> Result<ModelsDirectoryInfo, String> {
    ensure_no_running_models(&app)?;
    let default = set_models_dir(default_models_dir()?)?;
    delete_ui_preference_sync(&app, MODEL_STORAGE_PREFERENCE_KEY)?;
    debug_assert_eq!(default, resolve_models_dir()?);
    directory_info()
}

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
