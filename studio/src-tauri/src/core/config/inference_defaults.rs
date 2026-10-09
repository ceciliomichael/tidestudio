use serde::{Deserialize, Serialize};

use super::ServerConfig;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceDefaults {
    #[serde(default)]
    pub system_prompt: String,
    pub thinking_enabled: Option<bool>,
    #[serde(default = "default_reasoning_effort")]
    pub reasoning_effort: String,
    pub reasoning_budget: Option<i32>,
    pub reasoning_preserve: Option<bool>,
    pub temperature: Option<f32>,
    pub top_k: Option<i32>,
    pub top_p: Option<f32>,
    pub min_p: Option<f32>,
    pub typical_p: Option<f32>,
    pub seed: Option<i64>,
    pub repeat_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
    pub frequency_penalty: Option<f32>,
}

fn default_reasoning_effort() -> String {
    "default".to_string()
}

impl From<&ServerConfig> for InferenceDefaults {
    fn from(config: &ServerConfig) -> Self {
        Self {
            system_prompt: config.system_prompt.clone(),
            thinking_enabled: config
                .supports_thinking_toggle
                .then_some(config.thinking_enabled),
            reasoning_effort: if config.supports_reasoning_effort {
                config.reasoning_effort.clone()
            } else {
                "default".to_string()
            },
            reasoning_budget: config
                .supports_reasoning
                .then_some(config.reasoning_budget)
                .flatten(),
            reasoning_preserve: config
                .supports_reasoning_preserve
                .then_some(config.reasoning_preserve),
            temperature: config.temperature,
            top_k: config.top_k,
            top_p: config.top_p,
            min_p: config.min_p,
            typical_p: config.typical_p,
            seed: config.seed,
            repeat_penalty: config.repeat_penalty,
            presence_penalty: config.presence_penalty,
            frequency_penalty: config.frequency_penalty,
        }
    }
}
