use super::{GatewayConfig, client::GatewayClient, process::spawn_gateway};
use crate::core::config::InferenceDefaults;
use std::{
    process::Child,
    thread,
    time::{Duration, Instant},
};

#[derive(Default)]
pub struct GatewayManager {
    child: Option<Child>,
    config: Option<GatewayConfig>,
    client: GatewayClient,
}

impl GatewayManager {
    pub fn ensure(&mut self, config: GatewayConfig) -> Result<(), String> {
        if self.config.as_ref() == Some(&config) && self.is_running() {
            return Ok(());
        }

        self.shutdown();
        if config.api_key_enabled && config.api_key.trim().is_empty() {
            return Err("authentication requires an API key".to_string());
        }

        let mut child = spawn_gateway(&config, &self.client.token)?;
        let deadline = Instant::now() + Duration::from_secs(8);

        while Instant::now() < deadline {
            if let Some(exit) = child.try_wait().map_err(|error| error.to_string())? {
                return Err(format!("API gateway exited during startup: {exit}"));
            }
            if self.client.healthy(&config) {
                self.config = Some(config);
                self.child = Some(child);
                return Ok(());
            }
            thread::sleep(Duration::from_millis(100));
        }

        let _ = child.kill();
        let _ = child.wait();
        Err("API gateway startup timed out".to_string())
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

    fn shutdown(&mut self) {
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
