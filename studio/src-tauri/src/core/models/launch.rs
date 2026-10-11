use crate::core::{
    config::ServerConfig,
    models::{discover_models, load_model_settings, ModelInfo},
    paths::resolve_models_dir,
};
use serde_json::{json, Value};
use std::path::Path;

pub fn model_id(path: &str) -> Result<String, String> {
    let root = resolve_models_dir()?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    let relative = file
        .strip_prefix(root)
        .map_err(|_| "model is outside the managed directory")?;
    let id = relative.to_string_lossy().replace('\\', "/");
    Ok(id.strip_suffix(".gguf").unwrap_or(&id).to_string())
}

pub fn installed_ids() -> Result<Vec<String>, String> {
    discover_models()?
        .iter()
        .map(|model| model_id(&model.path))
        .collect()
}

pub fn config_for_id(id: &str) -> Result<ServerConfig, String> {
    let model = discover_models()?
        .into_iter()
        .find(|model| model_id(&model.path).as_deref() == Ok(id))
        .ok_or_else(|| format!("model is not installed: {id}"))?;

    build_config(&model)
}

fn build_config(model: &ModelInfo) -> Result<ServerConfig, String> {
    let llm = model.category == "LLM";
    let mut value = json!({
        "modelPath": model.path,
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
