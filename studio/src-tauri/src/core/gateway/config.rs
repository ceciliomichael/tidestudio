use serde::Deserialize;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub port: u16,
    pub serve_on_local_network: bool,
    pub api_key_enabled: bool,
    pub api_key: String,
    pub cors_enabled: bool,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            serve_on_local_network: false,
            api_key_enabled: false,
            api_key: String::new(),
            cors_enabled: true,
        }
    }
}
