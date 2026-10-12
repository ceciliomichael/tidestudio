use crate::core::{
    config::ServerConfig,
    models::{ModelInfo, discover_models, load_model_settings},
    paths::resolve_models_dir,
};
use serde_json::{Value, json};
use std::{collections::HashMap, path::Path};

fn model_id_from_file(file: &Path) -> Result<String, String> {
    let is_gguf = file
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("gguf"));
    if !is_gguf {
        return Err("model ID requires a GGUF file".to_string());
    }

    file.file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "model has no valid filename".to_string())
}

pub fn model_id(path: &str) -> Result<String, String> {
    let root = resolve_models_dir()?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    file.strip_prefix(root)
        .map_err(|_| "model is outside the managed directory")?;
    model_id_from_file(&file)
}

pub fn installed_ids() -> Result<Vec<String>, String> {
    let ids = discover_models()?
        .iter()
        .map(|model| model_id(&model.path))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(unambiguous_ids(ids))
}

fn unambiguous_ids(ids: Vec<String>) -> Vec<String> {
    // The API identifies models by filename, so do not advertise ambiguous
    // filenames for JIT loads. An ambiguous ID could start the wrong GGUF.
    let mut counts = HashMap::new();
    for id in &ids {
        *counts.entry(id.clone()).or_insert(0_usize) += 1;
    }
    ids.into_iter()
        .filter(|id| counts.get(id) == Some(&1))
        .collect()
}

pub fn config_for_id(id: &str) -> Result<ServerConfig, String> {
    let mut models = discover_models()?
        .into_iter()
        .filter(|model| model_id(&model.path).as_deref() == Ok(id));
    let model = models
        .next()
        .ok_or_else(|| format!("model is not installed: {id}"))?;
    if models.next().is_some() {
        return Err(format!(
            "multiple installed GGUF files have the model ID '{id}'; use unique filenames"
        ));
    }

    build_config(&model)
}

fn build_config(model: &ModelInfo) -> Result<ServerConfig, String> {
    let llm = model.category == "LLM";
    let mut value = json!({
        "modelPath": model.path,
        "runtimeId": "auto",
        "modelName": model.name,
        "modelCategory": model.category,
        "modelId": model_id(&model.path)?,
        "quantization": model.quantization.clone().unwrap_or_default(),
        "supportsReasoning": llm && model.supports_reasoning,
        "supportsThinkingToggle": llm && model.supports_thinking_toggle,
        "supportsReasoningEffort": llm && model.supports_reasoning_effort,
        "supportsReasoningPreserve": llm && model.supports_reasoning_preserve,
        "supportsMtp": llm && model.supports_mtp,
        "supportsVision": model.supports_vision,
        "supportsTools": model.supports_tools,
        "port": 0,
        "contextSize": 4096,
        "gpuLayers": 99,
        "systemPrompt": "",
        "chatTemplate": if llm { model.chat_template.clone().unwrap_or_default() } else { String::new() },
        "thinkingEnabled": false,
        "reasoningEffort": "default",
        "reasoningBudget": 1024,
        "reasoningPreserve": true,
        "temperature": 0.8,
        "topK": 40,
        "topP": 0.95,
        "minP": 0.05,
        "typicalP": 1.0,
        "seed": -1,
        "repeatPenalty": 1.0,
        "presencePenalty": 0.0,
        "frequencyPenalty": 0.0,
        "flashAttention": true,
        "embeddingPooling": match model.pooling_type.as_deref() {
            Some("mean" | "cls" | "last") => model.pooling_type.as_deref().unwrap_or("model"),
            _ => "model",
        },
        "speculativeMode": if llm && model.supports_mtp { "mtp" } else { "none" },
        "draftModelPath": "",
        "draftGpuLayers": 99,
        "draftMaxTokens": 3,
        "draftMinTokens": 0,
        "draftMinProbability": 0.0,
        "extraArgs": []
    });

    let tuning_defaults = json!({
        "cpuThreads": null,
        "batchSize": null,
        "microBatchSize": null,
        "parallelSlots": null,
        "kvCacheOffload": true,
        "ropeFrequencyBase": null,
        "ropeFrequencyScale": null,
    });
    for (key, setting) in tuning_defaults.as_object().expect("load tuning defaults") {
        value[key] = setting.clone();
    }

    if let Some(settings) = load_model_settings(&model.path)? {
        for section in ["load", "inference"] {
            let Some(saved) = settings.get(section).and_then(Value::as_object) else {
                continue;
            };
            let defaults = value.as_object_mut().expect("launch config object");
            for (key, selected) in saved {
                if defaults.contains_key(key) {
                    // An empty saved template means the embedded GGUF template.
                    if key == "runtimeId" {
                        continue;
                    }
                    if key == "chatTemplate" && selected.as_str() == Some("") {
                        continue;
                    }
                    defaults.insert(key.clone(), selected.clone());
                }
            }
        }
    }

    if !llm {
        let fields = [
            "thinkingEnabled",
            "reasoningPreserve",
            "supportsReasoning",
            "supportsThinkingToggle",
            "supportsReasoningEffort",
            "supportsReasoningPreserve",
        ];
        for key in fields {
            value[key] = json!(false);
        }
        value["reasoningBudget"] = Value::Null;
        value["reasoningEffort"] = json!("default");
        value["speculativeMode"] = json!("none");
        value["systemPrompt"] = json!("");
        value["chatTemplate"] = json!("");
    }
    if !model.supports_mtp && value["speculativeMode"] == "mtp" {
        value["speculativeMode"] = json!("none");
    }

    serde_json::from_value(value).map_err(|e| format!("invalid model launch settings: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_id_uses_only_gguf_filename_without_extension() {
        assert_eq!(
            model_id_from_file(Path::new("publisher/repo/Model-Q4_K_M.gguf")).unwrap(),
            "Model-Q4_K_M"
        );
        assert_eq!(
            model_id_from_file(Path::new("publisher/other/Model-Q4_K_M.GGUF")).unwrap(),
            "Model-Q4_K_M"
        );
        assert!(model_id_from_file(Path::new("publisher/repo/model.bin")).is_err());
    }

    #[test]
    fn jit_catalog_excludes_ambiguous_filename_ids() {
        assert_eq!(
            unambiguous_ids(vec![
                "Model-Q4".to_string(),
                "Model-Q8".to_string(),
                "Model-Q4".to_string(),
            ]),
            vec!["Model-Q8"]
        );
    }
}
