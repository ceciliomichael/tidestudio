use std::{
    env, fs,
    path::{Path, PathBuf},
};

pub fn resolve_runtime_binary(directory: &str, executable: &str) -> Result<PathBuf, String> {
    if !cfg!(debug_assertions) {
        let current_exe = env::current_exe()
            .map_err(|error| format!("failed to locate installed TideStudio: {error}"))?;
        let path = installed_runtime_path(&current_exe, directory, executable)?;

        return path.is_file().then_some(path).ok_or_else(|| {
            format!("bundled {executable} is missing from the TideStudio installation")
        });
    }

    let cwd = env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))?;
    let manifest_runtime = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("runtime");

    [
        cwd.join("runtime").join(directory).join(executable),
        cwd.join("studio")
            .join("runtime")
            .join(directory)
            .join(executable),
        manifest_runtime.join(directory).join(executable),
    ]
    .into_iter()
    .find(|path| path.is_file())
    .ok_or_else(|| format!("could not find development runtime executable {executable}"))
}

fn installed_runtime_path(
    executable_path: &Path,
    directory: &str,
    executable: &str,
) -> Result<PathBuf, String> {
    let installation = executable_path
        .parent()
        .ok_or_else(|| "could not resolve TideStudio installation directory".to_string())?;

    Ok(installation
        .join("runtime")
        .join(directory)
        .join(executable))
}

pub fn resolve_models_dir() -> Result<PathBuf, String> {
    if cfg!(windows) && !cfg!(debug_assertions) {
        let local_data = env::var_os("LOCALAPPDATA")
            .ok_or_else(|| "LOCALAPPDATA is not available for model storage".to_string())?;
        let directory = installed_models_dir(&PathBuf::from(local_data));

        fs::create_dir_all(&directory)
            .map_err(|error| format!("failed to create {}: {error}", directory.display()))?;

        return Ok(directory);
    }

    let current_dir = env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))?;

    [
        current_dir.join("models"),
        current_dir.join("..").join("models"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("models"),
    ]
    .into_iter()
    .find(|path| path.is_dir())
    .ok_or_else(|| "could not find the TideStudio models directory".to_string())
}

fn installed_models_dir(local_data: &Path) -> PathBuf {
    local_data.join("TideStudio").join("models")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installed_runtime_resolves_relative_to_executable() {
        let executable = Path::new("C:/Program Files/TideStudio/TideStudio.exe");
        let resolved = installed_runtime_path(&executable, "llama.cpp", "llama-server.exe")
            .expect("resolve bundled runtime");

        assert_eq!(
            resolved,
            PathBuf::from("C:/Program Files/TideStudio/runtime/llama.cpp/llama-server.exe")
        );
    }

    #[test]
    fn installed_models_remain_in_writable_user_storage() {
        let local_data = Path::new("C:/Users/Test/AppData/Local");

        assert_eq!(
            installed_models_dir(local_data),
            PathBuf::from("C:/Users/Test/AppData/Local/TideStudio/models")
        );
    }
}
