use super::{CapabilityHints, ModelInfo, inspect_gguf};
use crate::core::paths;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

pub fn discover_models() -> Result<Vec<ModelInfo>, String> {
    let models_dir = resolve_models_dir()?;
    let mut models = Vec::new();
    let mut vision_directories = HashSet::new();

    scan_directory(
        &models_dir,
        &models_dir,
        &mut models,
        &mut vision_directories,
    )?;

    for model in &mut models {
        if Path::new(&model.path)
            .parent()
            .is_some_and(|parent| vision_directories.contains(parent))
        {
            model.supports_vision = true;
        }
    }
    models.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok(models)
}

pub(crate) fn resolve_models_dir() -> Result<PathBuf, String> {
    paths::resolve_models_dir()
}

fn scan_directory(
    models_dir: &Path,
    directory: &Path,
    models: &mut Vec<ModelInfo>,
    vision_directories: &mut HashSet<PathBuf>,
) -> Result<(), String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("failed to read {}: {error}", directory.display()))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("failed to read model entry: {error}"))?;
        let path = entry.path();

        if path.is_dir() {
            scan_directory(models_dir, &path, models, vision_directories)?;
            continue;
        }

        let is_gguf = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("gguf"));

        if !is_gguf {
            continue;
        }

        let filename = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Unknown model")
            .to_string();

        if filename.to_ascii_lowercase().contains("mmproj") {
            if let Some(parent) = path.parent() {
                vision_directories.insert(parent.to_path_buf());
            }
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|error| format!("failed to read {} metadata: {error}", path.display()))?;

        let relative = path.strip_prefix(models_dir).unwrap_or(&path);
        let repo_hint = relative.to_string_lossy().replace('\\', "/");
        let tags = Vec::new();

        let inspection = inspect_gguf(
            &path,
            CapabilityHints {
                repo_id: &repo_hint,
                filename: &filename,
                tags: &tags,
                pipeline_tag: None,
            },
        )
        .ok();

        let name = inspection
            .as_ref()
            .and_then(|value| value.model_name.clone())
            .unwrap_or_else(|| filename.trim_end_matches(".gguf").to_string());

        let components = relative
            .components()
            .filter_map(|component| component.as_os_str().to_str())
            .collect::<Vec<_>>();
        let publisher = if components
            .first()
            .is_some_and(|value| *value == "modelscope")
            && components.len() > 2
        {
            components[1].to_string()
        } else if components.len() > 1 {
            components[0].to_string()
        } else {
            "Local".to_string()
        };

        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .and_then(|duration| u64::try_from(duration.as_millis()).ok());

        models.push(ModelInfo {
            name,
            path: path.to_string_lossy().into_owned(),
            size_bytes: metadata.len(),
            modified_ms,
            publisher,
            category: inspection
                .as_ref()
                .map(|value| value.capabilities.category.clone())
                .unwrap_or_else(|| "LLM".to_string()),
            architecture: inspection
                .as_ref()
                .and_then(|value| value.architecture.clone()),
            parameters: inspection
                .as_ref()
                .and_then(|value| value.parameter_size.clone()),
            context_length: inspection.as_ref().and_then(|value| value.context_length),
            pooling_type: inspection
                .as_ref()
                .and_then(|value| value.pooling_type.clone()),
            quantization: infer_quantization(&filename),
            chat_template: inspection
                .as_ref()
                .and_then(|value| value.chat_template.clone()),
            tokenizer_fingerprint: inspection
                .as_ref()
                .and_then(|value| value.tokenizer_fingerprint.clone()),
            supports_mtp: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.mtp.supported),
            supports_reasoning: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.reasoning.supported),
            supports_thinking_toggle: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.thinking_toggle.supported),
            supports_reasoning_effort: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.reasoning_effort.supported),
            supports_reasoning_preserve: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.reasoning_preserve.supported),
            supports_vision: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.vision.supported),
            supports_tools: inspection
                .as_ref()
                .is_some_and(|value| value.capabilities.tools.supported),
        });
    }

    Ok(())
}

fn infer_quantization(filename: &str) -> Option<String> {
    let upper = filename.to_uppercase();
    const QUANTS: &[&str] = &[
        "IQ1_S", "IQ1_M", "IQ2_XXS", "IQ2_XS", "IQ2_S", "IQ2_M", "IQ3_XXS", "IQ3_XS", "IQ3_S",
        "IQ3_M", "IQ4_XS", "IQ4_NL", "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_1",
        "Q4_K_S", "Q4_K_M", "Q5_0", "Q5_1", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "BF16",
        "F32",
    ];

    QUANTS
        .iter()
        .find(|quant| upper.contains(**quant))
        .map(|value| (*value).to_string())
}
