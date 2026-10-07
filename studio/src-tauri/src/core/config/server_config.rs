use serde::Deserialize;

fn default_host() -> String {
    "127.0.0.1".to_string()
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub model_path: String,
    #[serde(default = "default_host")]
    pub host: String,
    pub port: u16,
    pub context_size: Option<u32>,
    pub gpu_layers: Option<i32>,
    pub temperature: Option<f32>,
    #[serde(default)]
    pub flash_attention: bool,
    #[serde(default)]
    pub extra_args: Vec<String>,
}
