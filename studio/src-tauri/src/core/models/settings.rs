use serde_json::Value;
use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use super::resolve_models_dir;

const SETTINGS_SUFFIX: &str = ".tidestudio.json";

pub fn load_model_settings(model_path: &str) -> Result<Option<Value>, String> {
    let settings_path = settings_path_for_model(model_path)?;
    if !settings_path.is_file() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&settings_path)
        .map_err(|error| format!("failed to read {}: {error}", settings_path.display()))?;
    let value = serde_json::from_str::<Value>(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", settings_path.display()))?;
    validate_settings(&value)?;
    Ok(Some(value))
}

pub fn save_model_settings(model_path: &str, settings: &Value) -> Result<(), String> {
    validate_settings(settings)?;
    let settings_path = settings_path_for_model(model_path)?;
    let encoded = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("failed to encode model settings: {error}"))?;

    fs::write(&settings_path, format!("{encoded}\n"))
        .map_err(|error| format!("failed to write {}: {error}", settings_path.display()))
}

pub fn delete_managed_model(model_path: &str) -> Result<(), String> {
    let settings_path = settings_path_for_model(model_path)?;
    let model = Path::new(model_path)
        .canonicalize()
        .map_err(|error| format!("failed to resolve model path: {error}"))?;

    fs::remove_file(&model)
        .map_err(|error| format!("failed to delete {}: {error}", model.display()))?;

    if settings_path.is_file() {
        fs::remove_file(&settings_path).map_err(|error| {
            format!(
                "model deleted, but failed to delete {}: {error}",
                settings_path.display()
            )
        })?;
    }

    Ok(())
}

fn settings_path_for_model(model_path: &str) -> Result<PathBuf, String> {
    let root = resolve_models_dir()?
        .canonicalize()
        .map_err(|error| format!("failed to resolve models directory: {error}"))?;
    let model = Path::new(model_path)
        .canonicalize()
        .map_err(|error| format!("failed to resolve model path: {error}"))?;

    if !model.starts_with(&root) {
        return Err("model settings can only be stored for managed TideStudio models".to_string());
    }
    if !model
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("gguf"))
    {
        return Err("model settings require a GGUF model path".to_string());
    }
    if model
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.to_ascii_lowercase().contains("mmproj"))
    {
        return Err("projector GGUF files do not have model settings".to_string());
    }

    let mut path: OsString = model.as_os_str().to_os_string();
    path.push(SETTINGS_SUFFIX);
    Ok(PathBuf::from(path))
}

fn validate_settings(settings: &Value) -> Result<(), String> {
    let object = settings
        .as_object()
        .ok_or_else(|| "model settings must be a JSON object".to_string())?;
    if object.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("unsupported model settings version".to_string());
    }
    if !object.get("load").is_some_and(Value::is_object) {
        return Err("model settings must contain a load object".to_string());
    }
    if !object.get("inference").is_some_and(Value::is_object) {
        return Err("model settings must contain an inference object".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unversioned_settings() {
        let settings = serde_json::json!({"load": {}, "inference": {}});
        assert!(validate_settings(&settings).is_err());
    }

    #[test]
    fn accepts_versioned_settings() {
        let settings = serde_json::json!({
            "version": 1,
            "load": {},
            "inference": {}
        });
        assert!(validate_settings(&settings).is_ok());
    }
}
