use super::{GatewayConfig, client::GatewayClient, process::spawn_gateway};
use crate::core::config::InferenceDefaults;
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
