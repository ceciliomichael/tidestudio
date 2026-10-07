use super::ModelInfo;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn discover_models() -> Result<Vec<ModelInfo>, String> {
    let models_dir = resolve_models_dir()?;
    let mut models = Vec::new();

    scan_directory(&models_dir, &mut models)?;
    models.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok(models)
}

fn resolve_models_dir() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))?;

    let candidates = [
        current_dir.join("models"),
        current_dir.join("..").join("models"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("models"),
    ];

    candidates
        .into_iter()
        .find(|candidate| candidate.is_dir())
        .ok_or_else(|| "could not find the TideStudio models directory".to_string())
}

fn scan_directory(directory: &Path, models: &mut Vec<ModelInfo>) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("failed to read {}: {error}", directory.display()))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("failed to read model entry: {error}"))?;
        let path = entry.path();

        if path.is_dir() {
            scan_directory(&path, models)?;
            continue;
        }

        let is_gguf = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("gguf"));

        if !is_gguf {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|error| format!("failed to read {} metadata: {error}", path.display()))?;

        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Unknown model")
            .to_string();

        models.push(ModelInfo {
            name,
            path: path.to_string_lossy().into_owned(),
            size_bytes: metadata.len(),
        });
    }

    Ok(())
}
