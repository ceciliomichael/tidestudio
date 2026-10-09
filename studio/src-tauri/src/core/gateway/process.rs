use super::GatewayConfig;
use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
};

fn resolve_gateway() -> Result<PathBuf, String> {
    let executable = if cfg!(windows) {
        "tidestudio-api-gateway.exe"
    } else {
        "tidestudio-api-gateway"
    };
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let candidates = [
        cwd.join("runtime/api-gateway").join(executable),
        cwd.join("studio/runtime/api-gateway").join(executable),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../runtime/api-gateway")
            .join(executable),
    ];

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "API gateway binary missing: run npm run build:api-gateway".to_string())
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

    Command::new(resolve_gateway()?)
        .env("TIDE_GATEWAY_ADDR", format!("{host}:{}", config.port))
        .env("TIDE_GATEWAY_API_KEY", api_key)
        .env("TIDE_GATEWAY_CORS", config.cors_enabled.to_string())
        .env("TIDE_GATEWAY_CONTROL_TOKEN", token)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to launch API gateway: {error}"))
}
