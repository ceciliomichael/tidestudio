mod commands;
mod core;

use core::{
    backends::llama_cpp::LlamaCppBackend, gateway::GatewayManager, servers::ServerRegistry,
};
use std::sync::Mutex;

pub struct AppState {
    pub servers: Mutex<ServerRegistry>,
    pub gateway: Mutex<GatewayManager>,
    pub gateway_port: Mutex<u16>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            servers: Mutex::new(ServerRegistry::new(Box::new(LlamaCppBackend))),
            gateway: Mutex::new(GatewayManager::default()),
            gateway_port: Mutex::new(8080),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::downloads::search_huggingface_models,
            commands::downloads::huggingface_model_files,
            commands::downloads::download_huggingface_file,
            commands::downloads::search_modelscope_models,
            commands::downloads::modelscope_model_files,
            commands::downloads::download_modelscope_file,
            commands::models::list_models,
            commands::models::load_model_settings,
            commands::models::save_model_settings,
            commands::models::delete_model,
            commands::preferences::get_ui_preference,
            commands::preferences::set_ui_preference,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::update_server_inference,
            commands::server::list_servers,
            commands::server::server_status,
            commands::server::server_logs,
            commands::server::configure_gateway,
            commands::server::gateway_status,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run TideStudio");
}
