use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub port: u16,
    pub serve_on_local_network: bool,
    pub api_key_enabled: bool,
    pub api_key: String,
    pub cors_enabled: bool,
    #[serde(default = "default_true")]
    pub jit_model_loading: bool,
    #[serde(default = "default_true")]
    pub auto_unload_jit_models: bool,
    #[serde(default = "default_idle_ttl")]
    pub max_idle_ttl_minutes: u32,
    #[serde(default = "default_true")]
    pub only_keep_last_jit_model: bool,
}

fn default_true() -> bool {
    true
}

fn default_idle_ttl() -> u32 {
    60
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 3456,
            serve_on_local_network: false,
            api_key_enabled: false,
            api_key: String::new(),
            cors_enabled: true,
            jit_model_loading: true,
            auto_unload_jit_models: true,
            max_idle_ttl_minutes: 60,
            only_keep_last_jit_model: true,
        }
    }
}
