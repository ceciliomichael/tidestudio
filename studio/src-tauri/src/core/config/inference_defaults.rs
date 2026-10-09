use serde::{Deserialize, Serialize};

use super::ServerConfig;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceDefaults {
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default)]
    pub thinking_enabled: bool,
    #[serde(default = "default_reasoning_effort")]
    pub reasoning_effort: String,
    pub reasoning_budget: Option<i32>,
    #[serde(default)]
    pub reasoning_preserve: bool,
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
            thinking_enabled: config.thinking_enabled,
            reasoning_effort: config.reasoning_effort.clone(),
            reasoning_budget: config.reasoning_budget,
            reasoning_preserve: config.reasoning_preserve,
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
