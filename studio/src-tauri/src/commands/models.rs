use crate::core::models::{ModelInfo, discover_models};

#[tauri::command]
pub fn list_models() -> Result<Vec<ModelInfo>, String> {
    discover_models()
}
