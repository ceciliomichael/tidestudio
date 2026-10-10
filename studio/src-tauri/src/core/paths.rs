use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::{OnceLock, RwLock},
};

pub const MODEL_STORAGE_PREFERENCE_KEY: &str = "models.directory.v1";
static ACTIVE_MODELS_DIR: OnceLock<RwLock<PathBuf>> = OnceLock::new();

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
    if let Some(active) = ACTIVE_MODELS_DIR.get() {
        return active
            .read()
            .map(|path| path.clone())
            .map_err(|_| "models directory lock poisoned".to_string());
    }

    initialize_models_dir(None)
}

pub fn default_models_dir() -> Result<PathBuf, String> {
    let profile = if cfg!(windows) {
        env::var_os("USERPROFILE")
            .ok_or_else(|| "USERPROFILE is not available for model storage".to_string())?
    } else {
        env::var_os("HOME").ok_or_else(|| "HOME is not available for model storage".to_string())?
    };
    Ok(default_models_dir_for_profile(Path::new(&profile)))
}

fn default_models_dir_for_profile(profile: &Path) -> PathBuf {
    profile.join(".tidestudio").join("models")
}

pub fn initialize_models_dir(preferred: Option<&str>) -> Result<PathBuf, String> {
    let path = preferred
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or(default_models_dir()?);
    set_models_dir(path)
}

pub fn set_models_dir(path: PathBuf) -> Result<PathBuf, String> {
    let path = prepare_models_dir(path)?;
    if let Some(active) = ACTIVE_MODELS_DIR.get() {
        *active
            .write()
            .map_err(|_| "models directory lock poisoned".to_string())? = path.clone();
    } else {
        let _ = ACTIVE_MODELS_DIR.set(RwLock::new(path.clone()));
    }
    Ok(path)
}

pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    if cfg!(windows) {
        if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{rest}");
        }
        if let Some(rest) = text.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    text.into_owned()
}

fn prepare_models_dir(path: PathBuf) -> Result<PathBuf, String> {
    fs::create_dir_all(&path)
        .map_err(|error| format!("failed to create {}: {error}", path.display()))?;
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("failed to resolve {}: {error}", path.display()))?;

    let probe = canonical.join(format!(".tidestudio-write-test-{}", std::process::id()));
    fs::write(&probe, b"ok")
        .map_err(|error| format!("model directory is not writable: {error}"))?;
    fs::remove_file(&probe)
        .map_err(|error| format!("failed to clean model directory write test: {error}"))?;
    Ok(canonical)
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
    fn default_models_live_under_user_profile() {
        let profile = Path::new("C:/Users/Test");
        assert_eq!(
            default_models_dir_for_profile(profile),
            PathBuf::from("C:/Users/Test/.tidestudio/models")
        );
    }

    #[test]
    fn windows_verbatim_paths_are_cleaned_for_display() {
        assert_eq!(
            display_path(Path::new(r"\\?\C:\Users\Test\.tidestudio\models")),
            r"C:\Users\Test\.tidestudio\models"
        );
        assert_eq!(
            display_path(Path::new(r"\\?\UNC\server\share\models")),
            r"\\server\share\models"
        );
    }
}
