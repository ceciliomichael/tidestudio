mod commands;
mod core;

use core::{backends::llama_cpp::LlamaCppBackend, servers::ServerRegistry};
use std::sync::Mutex;

pub struct AppState {
    pub servers: Mutex<ServerRegistry>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            servers: Mutex::new(ServerRegistry::new(Box::new(LlamaCppBackend))),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::models::list_models,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::list_servers,
            commands::server::server_status,
            commands::server::server_logs,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TideStudio");
}
