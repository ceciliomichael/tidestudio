use crate::core::{
    backends::{InferenceBackend, ManagedInference},
    config::ServerConfig,
};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub backend: String,
    pub model_path: String,
    pub port: u16,
    pub pid: u32,
    pub running: bool,
}

struct RegisteredServer {
    backend: String,
    model_path: String,
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

    pub fn start(&mut self, config: ServerConfig) -> Result<ServerStatus, String> {
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
        let port = config.port;
        let instance = self.backend.start(&config)?;
        let status = ServerStatus {
            backend: backend.clone(),
            model_path: model_path.clone(),
            port,
            pid: instance.pid(),
            running: true,
        };

        self.servers.insert(
            port,
            RegisteredServer {
                backend,
                model_path,
                instance,
            },
        );

        Ok(status)
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
            port,
            pid,
            running: false,
        })
    }

    pub fn status(&mut self, port: u16) -> Result<Option<ServerStatus>, String> {
        let Some(server) = self.servers.get_mut(&port) else {
            return Ok(None);
        };

        Ok(Some(ServerStatus {
            backend: server.backend.clone(),
            model_path: server.model_path.clone(),
            port,
            pid: server.instance.pid(),
            running: server.instance.is_running()?,
        }))
    }

    pub fn list(&mut self) -> Result<Vec<ServerStatus>, String> {
        let mut statuses = Vec::with_capacity(self.servers.len());

        for (&port, server) in &mut self.servers {
            statuses.push(ServerStatus {
                backend: server.backend.clone(),
                model_path: server.model_path.clone(),
                port,
                pid: server.instance.pid(),
                running: server.instance.is_running()?,
            });
        }

        statuses.sort_by_key(|status| status.port);
        Ok(statuses)
    }

    pub fn logs(&self, port: u16) -> Vec<String> {
        self.servers
            .get(&port)
            .map(|server| server.instance.logs())
            .unwrap_or_default()
    }
}
