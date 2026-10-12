use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

use super::{
    catalog::{RuntimeSpec, spec},
    manager::{available_gpu, installed_path},
};
use crate::commands::preferences::set_ui_preference_sync;

pub const LLAMA_PREFERENCE_KEY: &str = "runtimes.preferred.llama_cpp.v1";
pub const PRISM_PREFERENCE_KEY: &str = "runtimes.preferred.prism_ml.v1";

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePreferences {
    #[serde(default = "automatic")]
    pub llama_cpp: String,
    #[serde(default = "automatic")]
    pub prism_ml: String,
}

fn automatic() -> String {
    "auto".into()
}

impl RuntimePreferences {
    fn defaults() -> Self {
        Self {
            llama_cpp: automatic(),
            prism_ml: automatic(),
        }
    }

    fn preferred(&self, prism: bool) -> &str {
        if prism {
            &self.prism_ml
        } else {
            &self.llama_cpp
        }
    }
}

static PREFERENCES: OnceLock<Mutex<RuntimePreferences>> = OnceLock::new();

fn state() -> &'static Mutex<RuntimePreferences> {
    PREFERENCES.get_or_init(|| Mutex::new(RuntimePreferences::defaults()))
}

fn engine_key(engine: &str) -> Result<(&'static str, bool), String> {
    match engine {
        "llama.cpp" => Ok((LLAMA_PREFERENCE_KEY, false)),
        "PrismML" => Ok((PRISM_PREFERENCE_KEY, true)),
        _ => Err(format!("unsupported runtime engine: {engine}")),
    }
}

fn valid_preference(engine: &str, id: &str) -> bool {
    id == "auto"
        || spec(id)
            .map(|runtime| runtime.engine == engine)
            .unwrap_or(false)
}

fn restored_preference(engine: &str, stored: Option<&str>) -> String {
    stored
        .filter(|id| valid_preference(engine, id))
        .unwrap_or("auto")
        .to_string()
}

pub fn initialize_preferences(llama: Option<&str>, prism: Option<&str>) -> Result<(), String> {
    let mut preferences = state()
        .lock()
        .map_err(|_| "runtime preference lock poisoned")?;
    *preferences = RuntimePreferences {
        llama_cpp: restored_preference("llama.cpp", llama),
        prism_ml: restored_preference("PrismML", prism),
    };
    Ok(())
}

pub fn get_preferences() -> Result<RuntimePreferences, String> {
    state()
        .lock()
        .map(|pref| pref.clone())
        .map_err(|_| "runtime preference lock poisoned".to_string())
}

pub fn preferred_runtime(prism: bool) -> Result<String, String> {
    Ok(get_preferences()?.preferred(prism).to_string())
}

pub fn set_preference(
    app: &AppHandle,
    engine: &str,
    id: &str,
) -> Result<RuntimePreferences, String> {
    let (key, is_prism) = engine_key(engine)?;
    if !valid_preference(engine, id) {
        return Err("runtime does not belong to the selected inference engine".to_string());
    }
    if id != "auto" {
        let runtime = spec(id)?;
        let executable =
            installed_path(runtime)?.ok_or_else(|| format!("{} is not installed", runtime.name))?;
        if !can_be_preferred(runtime, &executable) {
            return Err(format!(
                "{} does not have a compatible device available",
                runtime.name
            ));
        }
    }

    // Lock through persistence so concurrent preferences cannot publish
    // a stale value after the last SQLite write completes.
    let mut preferences = state()
        .lock()
        .map_err(|_| "runtime preference lock poisoned")?;
    set_ui_preference_sync(app, key, id)?;
    if is_prism {
        preferences.prism_ml = id.to_string();
    } else {
        preferences.llama_cpp = id.to_string();
    }
    Ok(preferences.clone())
}

fn can_be_preferred(runtime: &RuntimeSpec, executable: &std::path::Path) -> bool {
    runtime.accelerator == "cpu" || available_gpu(runtime, executable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_preferences_are_automatic_per_engine() {
        assert_eq!(RuntimePreferences::defaults().preferred(false), "auto");
        assert_eq!(RuntimePreferences::defaults().preferred(true), "auto");
    }

    #[test]
    fn persisted_preferences_are_validated_and_separated() {
        assert_eq!(
            restored_preference("llama.cpp", Some("llama-vulkan")),
            "llama-vulkan"
        );
        assert_eq!(
            restored_preference("PrismML", Some("prism-cpu")),
            "prism-cpu"
        );
        assert_eq!(restored_preference("PrismML", Some("llama-vulkan")), "auto");
        assert_eq!(restored_preference("llama.cpp", Some("bad-id")), "auto");
        assert_eq!(restored_preference("llama.cpp", None), "auto");
    }

    #[test]
    fn preference_keys_are_disjoint() {
        assert_ne!(LLAMA_PREFERENCE_KEY, PRISM_PREFERENCE_KEY);
        assert_eq!(engine_key("PrismML").unwrap().1, true);
        assert!(engine_key("other").is_err());
    }
}
