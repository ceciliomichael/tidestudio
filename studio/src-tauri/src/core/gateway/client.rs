use super::GatewayConfig;
use crate::core::config::InferenceDefaults;
use std::time::Duration;

pub(super) struct GatewayClient {
    client: reqwest::blocking::Client,
    pub(super) token: String,
}

impl Default for GatewayClient {
    fn default() -> Self {
        Self {
            token: uuid::Uuid::new_v4().to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(5))
                .no_proxy()
                .build()
                .expect("local HTTP client"),
        }
    }
}

impl GatewayClient {
    fn url(config: &GatewayConfig, path: &str) -> String {
        format!("http://127.0.0.1:{}{}", config.port, path)
    }

    pub(super) fn healthy(&self, config: &GatewayConfig) -> bool {
        let api_key = if config.api_key_enabled {
            config.api_key.as_str()
        } else {
            ""
        };

        self.client
            .get(Self::url(config, "/health"))
            .header("Authorization", format!("Bearer {api_key}"))
            .send()
            .map(|response| response.status().is_success())
            .unwrap_or(false)
    }

    pub(super) fn register(
        &self,
        config: &GatewayConfig,
        model_id: &str,
        port: u16,
        defaults: &InferenceDefaults,
    ) -> Result<(), String> {
        let path = format!("/_tidestudio/workers/{}", encode_model_id(model_id));
        let response = self
            .client
            .put(Self::url(config, &path))
            .header("X-TideStudio-Control-Token", &self.token)
            .json(&serde_json::json!({
                "model_id": model_id,
                "base_url": format!("http://127.0.0.1:{port}"),
                "defaults": defaults,
            }))
            .send()
            .map_err(|error| format!("gateway registration failed: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "gateway registration rejected: {}",
                response.status()
            ));
        }
        Ok(())
    }

    pub(super) fn unregister(&self, config: &GatewayConfig, model_id: &str) -> Result<(), String> {
        let path = format!("/_tidestudio/workers/{}", encode_model_id(model_id));
        let response = self
            .client
            .delete(Self::url(config, &path))
            .header("X-TideStudio-Control-Token", &self.token)
            .send()
            .map_err(|error| format!("gateway unregister failed: {error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "gateway unregister rejected: {}",
                response.status()
            ));
        }
        Ok(())
    }
}

fn encode_model_id(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
                (*byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}
