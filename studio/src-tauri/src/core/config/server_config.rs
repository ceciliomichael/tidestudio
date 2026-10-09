use serde::Deserialize;

fn default_reasoning_effort() -> String {
    "default".to_string()
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SpeculativeMode {
    #[default]
    None,
    Mtp,
    Draft,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub model_path: String,
    #[serde(default)]
    pub model_id: String,
    #[serde(default)]
    pub port: u16,
    pub context_size: Option<u32>,
    pub gpu_layers: Option<i32>,
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default)]
    pub chat_template: String,
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
    #[serde(default)]
    pub flash_attention: bool,
    #[serde(default)]
    pub speculative_mode: SpeculativeMode,
    #[serde(default)]
    pub draft_model_path: String,
    pub draft_gpu_layers: Option<i32>,
    pub draft_max_tokens: Option<u32>,
    pub draft_min_tokens: Option<u32>,
    pub draft_min_probability: Option<f32>,
    #[serde(default)]
    pub extra_args: Vec<String>,
}
