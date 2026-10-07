use crate::{
    AppState,
    core::{config::ServerConfig, servers::ServerStatus},
};
use tauri::State;

#[tauri::command]
pub fn start_server(
    state: State<'_, AppState>,
    config: ServerConfig,
) -> Result<ServerStatus, String> {
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| "server registry lock was poisoned".to_string())?;

    servers.start(config)
}

#[tauri::command]
pub fn stop_server(state: State<'_, AppState>, port: u16) -> Result<ServerStatus, String> {
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| "server registry lock was poisoned".to_string())?;

    servers.stop(port)
}

#[tauri::command]
pub fn list_servers(state: State<'_, AppState>) -> Result<Vec<ServerStatus>, String> {
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| "server registry lock was poisoned".to_string())?;

    servers.list()
}

#[tauri::command]
pub fn server_status(
    state: State<'_, AppState>,
    port: u16,
) -> Result<Option<ServerStatus>, String> {
    let mut servers = state
        .servers
        .lock()
        .map_err(|_| "server registry lock was poisoned".to_string())?;

    servers.status(port)
}

#[tauri::command]
pub fn server_logs(state: State<'_, AppState>, port: u16) -> Result<Vec<String>, String> {
    let servers = state
        .servers
        .lock()
        .map_err(|_| "server registry lock was poisoned".to_string())?;

    Ok(servers.logs(port))
}
