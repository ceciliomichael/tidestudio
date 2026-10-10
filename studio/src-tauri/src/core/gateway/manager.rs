use super::{GatewayConfig, client::GatewayClient, process::spawn_gateway};
use crate::core::config::InferenceDefaults;
use std::net::TcpListener;
use std::process::Child;

#[derive(Default)]
pub struct GatewayManager {
    child: Option<Child>,
    config: Option<GatewayConfig>,
    client: GatewayClient,
}

impl GatewayManager {
    pub fn start(&mut self, config: GatewayConfig) -> Result<(), String> {
        if self.config.as_ref() == Some(&config) && self.is_running() {
            return Ok(());
        }

        self.shutdown();
        if config.api_key_enabled && config.api_key.trim().is_empty() {
            return Err("authentication requires an API key".to_string());
        }

        let host = if config.serve_on_local_network {
            "0.0.0.0"
        } else {
            "127.0.0.1"
        };
        let listener = TcpListener::bind((host, config.port)).map_err(|error| {
            format!(
                "API port {} is already in use or unavailable ({error}). Stop the other process using this port, or choose another port in Server Settings.",
                config.port
            )
        })?;
        drop(listener);

        let child = spawn_gateway(&config, &self.client.token)?;
        self.config = Some(config);
        self.child = Some(child);
        Ok(())
    }

    pub fn register(
        &self,
        model_id: &str,
        port: u16,
        defaults: &InferenceDefaults,
    ) -> Result<(), String> {
        let config = self.config.as_ref().ok_or("gateway is not configured")?;
        self.client.register(config, model_id, port, defaults)
    }

    pub fn unregister(&self, model_id: &str) -> Result<(), String> {
        let Some(config) = &self.config else {
            return Ok(());
        };
        self.client.unregister(config, model_id)
    }

    pub fn is_running(&mut self) -> bool {
        self.child.as_mut().is_some_and(|child| {
            child
                .try_wait()
                .map(|status| status.is_none())
                .unwrap_or(false)
        })
    }

    pub fn matches_config(&self, config: &GatewayConfig) -> bool {
        self.config.as_ref() == Some(config)
    }

    pub fn shutdown(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.config = None;
    }
}

impl Drop for GatewayManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn occupied_port_returns_specific_error_without_starting_gateway() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("reserve test port");
        let port = listener.local_addr().expect("listener address").port();
        let config = GatewayConfig {
            port,
            ..GatewayConfig::default()
        };
        let mut gateway = GatewayManager::default();

        let error = gateway.start(config).expect_err("occupied port must fail");
        assert!(error.contains(&format!("API port {port}")));
        assert!(error.contains("already in use"));
        assert!(!gateway.is_running());
    }
}
