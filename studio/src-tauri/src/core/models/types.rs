use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_ms: Option<u64>,
    pub publisher: String,
    pub category: String,
    pub architecture: Option<String>,
    pub parameters: Option<String>,
    pub context_length: Option<u64>,
    pub quantization: Option<String>,
    pub chat_template: Option<String>,
    pub supports_mtp: bool,
    pub supports_reasoning: bool,
    pub supports_vision: bool,
}
