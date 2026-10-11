use serde::Deserialize;

fn default_reasoning_effort() -> String {
    "default".to_string()
}

fn default_true() -> bool {
    true
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
    pub model_name: String,
    #[serde(default = "default_model_category")]
    pub model_category: String,
    #[serde(default)]
    pub quantization: String,
    #[serde(default)]
    pub supports_reasoning: bool,
    #[serde(default)]
    pub supports_thinking_toggle: bool,
    #[serde(default)]
    pub supports_reasoning_effort: bool,
    #[serde(default)]
    pub supports_reasoning_preserve: bool,
    #[serde(default)]
    pub supports_mtp: bool,
    #[serde(default)]
    pub supports_vision: bool,
    #[serde(default)]
    pub supports_tools: bool,
    #[serde(default)]
    pub model_id: String,
    #[serde(default)]
    pub port: u16,
    pub context_size: Option<u32>,
    pub gpu_layers: Option<i32>,
    pub cpu_threads: Option<u32>,
    pub batch_size: Option<u32>,
    pub micro_batch_size: Option<u32>,
    pub parallel_slots: Option<u32>,
    #[serde(default = "default_true")]
    pub kv_cache_offload: bool,
    pub rope_frequency_base: Option<f32>,
    pub rope_frequency_scale: Option<f32>,
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
    #[serde(default = "default_embedding_pooling")]
    pub embedding_pooling: String,
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

fn default_model_category() -> String {
    "LLM".to_string()
}

fn default_embedding_pooling() -> String {
    "model".to_string()
}
