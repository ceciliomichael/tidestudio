use crate::core::config::ServerConfig;

pub trait ManagedInference: Send {
    fn pid(&self) -> u32;
    fn stop(&mut self) -> Result<(), String>;
    fn is_running(&mut self) -> Result<bool, String>;
    fn logs(&self) -> Vec<String>;
}

pub trait InferenceBackend: Send + Sync {
    fn id(&self) -> &'static str;
    fn start(&self, config: &ServerConfig) -> Result<Box<dyn ManagedInference>, String>;
}
