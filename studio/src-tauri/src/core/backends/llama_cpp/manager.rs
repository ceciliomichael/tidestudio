use crate::core::paths::resolve_runtime_binary;
use std::path::PathBuf;

pub fn resolve_llama_server() -> Result<PathBuf, String> {
    let executable_name = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    resolve_runtime_binary("llama.cpp", executable_name)
}
