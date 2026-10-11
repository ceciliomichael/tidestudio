use super::GatewayConfig;
use crate::core::{paths::resolve_runtime_binary, process::hide_console};
use std::process::{Child, Command, Stdio};

fn resolve_gateway() -> Result<std::path::PathBuf, String> {
    let executable = if cfg!(windows) {
        "tidestudio-api-gateway.exe"
    } else {
        "tidestudio-api-gateway"
    };
    resolve_runtime_binary("api-gateway", executable)
}

pub(super) fn spawn_gateway(config: &GatewayConfig, token: &str) -> Result<Child, String> {
    let host = if config.serve_on_local_network {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    };

    let api_key = if config.api_key_enabled {
        config.api_key.as_str()
    } else {
        ""
    };

    let mut command = Command::new(resolve_gateway()?);
    command
        .env("TIDE_GATEWAY_ADDR", format!("{host}:{}", config.port))
        .env("TIDE_GATEWAY_API_KEY", api_key)
        .env("TIDE_GATEWAY_CORS", config.cors_enabled.to_string())
        .env("TIDE_GATEWAY_JIT", config.jit_model_loading.to_string())
        .env("TIDE_GATEWAY_AUTO_UNLOAD", config.auto_unload_jit_models.to_string())
        .env("TIDE_GATEWAY_IDLE_TTL", config.max_idle_ttl_minutes.to_string())
        .env("TIDE_GATEWAY_KEEP_LAST", config.only_keep_last_jit_model.to_string())
        .env("TIDE_GATEWAY_CONTROL_TOKEN", token)
        .env("TIDE_GATEWAY_PARENT_PID", std::process::id().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    hide_console(&mut command);
    command
        .spawn()
        .map_err(|error| format!("failed to launch API gateway: {error}"))
}
