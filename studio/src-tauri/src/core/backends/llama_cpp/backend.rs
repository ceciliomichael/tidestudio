use super::process::spawn_llama_server;
use crate::core::{
    backends::{InferenceBackend, ManagedInference},
    config::ServerConfig,
    runtimes::select_runtime,
};

#[derive(Default)]
pub struct LlamaCppBackend;

impl InferenceBackend for LlamaCppBackend {
    fn id(&self) -> &'static str {
        "llama.cpp"
    }

    fn start(&self, config: &ServerConfig) -> Result<Box<dyn ManagedInference>, String> {
        let runtime = select_runtime(config)?;
        let mut selected_config = config.clone();
        selected_config.gpu_layers = runtime.gpu_layers;
        if runtime.gpu_layers == Some(0) {
            selected_config.flash_attention = false;
        }
        let instance = spawn_llama_server(
            &runtime.executable,
            &selected_config,
            runtime.id,
            runtime.fallback_reason,
        )?;

        Ok(Box::new(instance))
    }
}
