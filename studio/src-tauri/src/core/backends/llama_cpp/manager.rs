use std::path::PathBuf;

pub fn resolve_llama_server() -> Result<PathBuf, String> {
    let executable_name = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    let current_dir = std::env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))?;

    let candidates = [
        current_dir
            .join("runtime")
            .join("llama.cpp")
            .join(executable_name),
        current_dir
            .join("studio")
            .join("runtime")
            .join("llama.cpp")
            .join(executable_name),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("runtime")
            .join("llama.cpp")
            .join(executable_name),
    ];

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "could not find the bundled llama-server executable".to_string())
}
