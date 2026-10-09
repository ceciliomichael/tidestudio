use crate::core::{
    backends::{InferenceBackend, ManagedInference},
    config::{InferenceDefaults, ServerConfig},
};
use serde::Serialize;
use std::collections::HashMap;
use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerLifecycle {
    Loading,
    Ready,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub backend: String,
    pub model_path: String,
    pub model_id: String,
    pub port: u16,
    pub pid: u32,
    pub memory_bytes: u64,
    pub running: bool,
    pub state: ServerLifecycle,
}

fn process_memory_bytes(pid: u32) -> u64 {
    let pid = Pid::from_u32(pid);
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
    system
        .process(pid)
        .map(|process| process.memory())
        .unwrap_or(0)
}

struct RegisteredServer {
    backend: String,
    model_path: String,
    model_id: String,
    inference_defaults: InferenceDefaults,
    state: ServerLifecycle,
    instance: Box<dyn ManagedInference>,
}

pub struct ServerRegistry {
    backend: Box<dyn InferenceBackend>,
    servers: HashMap<u16, RegisteredServer>,
}

impl ServerRegistry {
    pub fn new(backend: Box<dyn InferenceBackend>) -> Self {
        Self {
            backend,
            servers: HashMap::new(),
        }
    }

    pub fn spawn(&mut self, config: ServerConfig) -> Result<ServerStatus, String> {
        if let Some(existing) = self.servers.get_mut(&config.port) {
            if existing.instance.is_running()? {
                return Err(format!(
                    "port {} is already managed by TideStudio",
                    config.port
                ));
            }
        }

        self.servers.remove(&config.port);

        let backend = self.backend.id().to_string();
        let model_path = config.model_path.clone();
        let model_id = config.model_id.clone();
        let inference_defaults = InferenceDefaults::from(&config);
        let port = config.port;
        let instance = self.backend.start(&config)?;
        let status = ServerStatus {
            backend: backend.clone(),
            model_path: model_path.clone(),
            model_id: model_id.clone(),
            port,
            pid: instance.pid(),
            memory_bytes: 0,
            running: true,
            state: ServerLifecycle::Loading,
        };

        self.servers.insert(
            port,
            RegisteredServer {
                backend,
                model_path,
                model_id,
                inference_defaults,
                state: ServerLifecycle::Loading,
                instance,
            },
        );

        Ok(status)
    }

    pub fn mark_ready(&mut self, port: u16) -> Result<ServerStatus, String> {
        let server = self
            .servers
            .get_mut(&port)
            .ok_or_else(|| format!("no TideStudio server is registered on port {port}"))?;
        server.state = ServerLifecycle::Ready;
        Self::status_for(port, server)
    }

    pub fn process_running(&mut self, port: u16) -> Result<Option<bool>, String> {
        self.servers
            .get_mut(&port)
            .map(|server| server.instance.is_running())
            .transpose()
    }

    pub fn matches_model(&self, port: u16, model_id: &str) -> bool {
        self.servers
            .get(&port)
            .is_some_and(|server| server.model_id == model_id)
    }

    pub fn contains_model_path(&self, model_path: &str) -> bool {
        self.servers
            .values()
            .any(|server| server.model_path == model_path)
    }

    pub fn inference_defaults(&self, port: u16) -> Option<InferenceDefaults> {
        self.servers
            .get(&port)
            .map(|server| server.inference_defaults.clone())
    }

    pub fn set_inference_defaults(
        &mut self,
        port: u16,
        defaults: InferenceDefaults,
    ) -> Result<(), String> {
        let server = self
            .servers
            .get_mut(&port)
            .ok_or_else(|| format!("no TideStudio server is registered on port {port}"))?;
        server.inference_defaults = defaults;
        Ok(())
    }

    pub fn stop(&mut self, port: u16) -> Result<ServerStatus, String> {
        let mut server = self
            .servers
            .remove(&port)
            .ok_or_else(|| format!("no TideStudio server is registered on port {port}"))?;

        let pid = server.instance.pid();
        server.instance.stop()?;

        Ok(ServerStatus {
            backend: server.backend,
            model_path: server.model_path,
            model_id: server.model_id,
            port,
            pid,
            memory_bytes: process_memory_bytes(pid),
            running: false,
            state: server.state,
        })
    }

    pub fn status(&mut self, port: u16) -> Result<Option<ServerStatus>, String> {
        let Some(server) = self.servers.get_mut(&port) else {
            return Ok(None);
        };

        Ok(Some(Self::status_for(port, server)?))
    }

    pub fn list(&mut self) -> Result<Vec<ServerStatus>, String> {
        let mut statuses = Vec::with_capacity(self.servers.len());

        for (&port, server) in &mut self.servers {
            statuses.push(Self::status_for(port, server)?);
        }

        statuses.sort_by_key(|status| status.port);
        for stopped in statuses
            .iter()
            .filter(|status| !status.running && status.state == ServerLifecycle::Ready)
        {
            self.servers.remove(&stopped.port);
        }
        Ok(statuses)
    }

    pub fn logs(&self, port: u16) -> Vec<String> {
        self.servers
            .get(&port)
            .map(|server| server.instance.logs())
            .unwrap_or_default()
    }

    fn status_for(port: u16, server: &mut RegisteredServer) -> Result<ServerStatus, String> {
        let pid = server.instance.pid();
        let running = server.instance.is_running()?;
        Ok(ServerStatus {
            backend: server.backend.clone(),
            model_path: server.model_path.clone(),
            model_id: server.model_id.clone(),
            port,
            pid,
            memory_bytes: if server.state == ServerLifecycle::Ready && running {
                process_memory_bytes(pid)
            } else {
                0
            },
            running,
            state: server.state,
        })
    }
}

impl Drop for ServerRegistry {
    fn drop(&mut self) {
        for (_, mut worker) in self.servers.drain() {
            let _ = worker.instance.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{
        backends::{InferenceBackend, ManagedInference},
        config::{ServerConfig, SpeculativeMode},
    };

    struct MockBackend;

    struct MockInstance {
        running: bool,
    }

    impl ManagedInference for MockInstance {
        fn pid(&self) -> u32 {
            std::process::id()
        }

        fn stop(&mut self) -> Result<(), String> {
            self.running = false;
            Ok(())
        }

        fn is_running(&mut self) -> Result<bool, String> {
            Ok(self.running)
        }

        fn logs(&self) -> Vec<String> {
            vec!["mock log".to_string()]
        }
    }

    impl InferenceBackend for MockBackend {
        fn id(&self) -> &'static str {
            "mock"
        }

        fn start(&self, _config: &ServerConfig) -> Result<Box<dyn ManagedInference>, String> {
            Ok(Box::new(MockInstance { running: true }))
        }
    }

    fn config() -> ServerConfig {
        ServerConfig {
            model_path: "model.gguf".to_string(),
            model_category: "LLM".to_string(),
            supports_reasoning: false,
            supports_thinking_toggle: false,
            supports_reasoning_effort: false,
            supports_reasoning_preserve: false,
            supports_mtp: false,
            model_id: "model".to_string(),
            port: 32123,
            context_size: None,
            gpu_layers: None,
            system_prompt: String::new(),
            chat_template: String::new(),
            thinking_enabled: false,
            reasoning_effort: "default".to_string(),
            reasoning_budget: None,
            reasoning_preserve: false,
            temperature: None,
            top_k: None,
            top_p: None,
            min_p: None,
            typical_p: None,
            seed: None,
            repeat_penalty: None,
            presence_penalty: None,
            frequency_penalty: None,
            flash_attention: false,
            embedding_pooling: "model".to_string(),
            speculative_mode: SpeculativeMode::None,
            draft_model_path: String::new(),
            draft_gpu_layers: None,
            draft_max_tokens: None,
            draft_min_tokens: None,
            draft_min_probability: None,
            extra_args: Vec::new(),
        }
    }

    #[test]
    fn worker_is_visible_as_loading_before_ready() {
        let mut registry = ServerRegistry::new(Box::new(MockBackend));

        let loading = registry.spawn(config()).expect("worker should spawn");
        assert_eq!(loading.state, ServerLifecycle::Loading);
        assert!(loading.running);

        let listed = registry.list().expect("worker should list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].state, ServerLifecycle::Loading);

        let ready = registry
            .mark_ready(loading.port)
            .expect("worker should become ready");
        assert_eq!(ready.state, ServerLifecycle::Ready);
        assert!(ready.running);
    }
}
