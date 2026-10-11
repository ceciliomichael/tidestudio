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

pub fn delete_managed_model(model_path: &str, running_paths: &[String]) -> Result<(), String> {
    let root = resolve_models_dir()?;
    delete_managed_model_in_root(&root, model_path, running_paths)
}

fn delete_managed_model_in_root(
    root: &Path,
    model_path: &str,
    running_paths: &[String],
) -> Result<(), String> {
    let (root, model) = validated_managed_model(root, model_path)?;
    if !model.is_file() {
        return Err("the selected GGUF is not a file".to_string());
    }
    let directory = model
        .parent()
        .ok_or_else(|| "failed to locate the model's containing folder".to_string())?;
    let directly_in_root = directory == root;

    for running_path in running_paths {
        let running_model = Path::new(running_path)
            .canonicalize()
            .map_err(|error| format!("failed to check loaded model {running_path}: {error}"))?;
        let overlaps = if directly_in_root {
            running_model == model
        } else {
            running_model.starts_with(directory)
        };
        if overlaps {
            return Err("stop all models loaded from this folder before deleting it".to_string());
        }
    }

    if !directly_in_root {
        return fs::remove_dir_all(directory)
            .map_err(|error| format!("failed to delete folder {}: {error}", directory.display()));
    }

    // A loose GGUF in the managed root must not cause the whole library to be deleted.
    let settings_path = settings_path_for_file(&model);
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
    let root = resolve_models_dir()?;
    let (_, model) = validated_managed_model(&root, model_path)?;
    Ok(settings_path_for_file(&model))
}

fn validated_managed_model(root: &Path, model_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("failed to resolve models directory: {error}"))?;
    let model = Path::new(model_path)
        .canonicalize()
        .map_err(|error| format!("failed to resolve model path: {error}"))?;

    if !model.starts_with(&root) || model == root {
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

    Ok((root, model))
}

fn settings_path_for_file(model: &Path) -> PathBuf {
    let mut path: OsString = model.as_os_str().to_os_string();
    path.push(SETTINGS_SUFFIX);
    PathBuf::from(path)
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

    struct TestModelsRoot(PathBuf);

    impl TestModelsRoot {
        fn new() -> Self {
            let path = std::env::temp_dir()
                .join(format!("tidestudio-delete-model-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&path).expect("create test models root");
            Self(path)
        }

        fn file(&self, relative: &str) -> PathBuf {
            let path = self.0.join(relative);
            fs::create_dir_all(path.parent().expect("file parent"))
                .expect("create test model directory");
            fs::write(&path, b"test").expect("write test model file");
            path
        }
    }

    impl Drop for TestModelsRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn model_path(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn deletes_entire_containing_folder_including_projectors_and_other_models() {
        let root = TestModelsRoot::new();
        let model = root.file("publisher/repo/model-Q4.gguf");
        root.file("publisher/repo/mmproj-F16.gguf");
        root.file("publisher/repo/model-Q8.gguf");
        root.file("publisher/repo/model-Q4.gguf.tidestudio.json");
        let other_model = root.file("publisher/other/keep.gguf");

        delete_managed_model_in_root(&root.0, &model_path(&model), &[])
            .expect("delete model folder");

        assert!(!root.0.join("publisher/repo").exists());
        assert!(other_model.exists());
        assert!(root.0.exists());
    }

    #[test]
    fn root_level_model_deletes_only_gguf_and_sidecar() {
        let root = TestModelsRoot::new();
        let model = root.file("loose.gguf");
        let sidecar = root.file("loose.gguf.tidestudio.json");
        let projector = root.file("mmproj-F16.gguf");

        delete_managed_model_in_root(&root.0, &model_path(&model), &[])
            .expect("delete root-level GGUF");

        assert!(!model.exists());
        assert!(!sidecar.exists());
        assert!(projector.exists());
        assert!(root.0.exists());
    }

    #[test]
    fn refuses_folder_deletion_while_sibling_model_is_loaded() {
        let root = TestModelsRoot::new();
        let model = root.file("publisher/repo/model-Q4.gguf");
        let running = root.file("publisher/repo/model-Q8.gguf");

        let result =
            delete_managed_model_in_root(&root.0, &model_path(&model), &[model_path(&running)]);

        assert!(result.is_err());
        assert!(model.exists());
        assert!(running.exists());
    }

    #[test]
    fn refuses_unmanaged_paths_and_projector_files() {
        let root = TestModelsRoot::new();
        let outside = TestModelsRoot::new();
        let foreign_model = outside.file("foreign.gguf");
        let projector = root.file("publisher/repo/mmproj-F16.gguf");

        assert!(delete_managed_model_in_root(&root.0, &model_path(&foreign_model), &[]).is_err());
        assert!(delete_managed_model_in_root(&root.0, &model_path(&projector), &[]).is_err());
        assert!(foreign_model.exists());
        assert!(projector.exists());
    }

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
