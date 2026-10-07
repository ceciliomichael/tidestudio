use super::{manager::resolve_llama_server, process::spawn_llama_server};
use crate::core::{
    backends::{InferenceBackend, ManagedInference},
    config::ServerConfig,
};

#[derive(Default)]
pub struct LlamaCppBackend;

impl InferenceBackend for LlamaCppBackend {
    fn id(&self) -> &'static str {
        "llama.cpp"
    }

    fn start(&self, config: &ServerConfig) -> Result<Box<dyn ManagedInference>, String> {
        let executable = resolve_llama_server()?;
        let instance = spawn_llama_server(&executable, config)?;

        Ok(Box::new(instance))
    }
}
