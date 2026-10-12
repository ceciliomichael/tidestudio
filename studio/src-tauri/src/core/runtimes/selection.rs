use super::{
    catalog::{RuntimeSpec, is_prism_model, spec},
    manager::{available_gpu, installed_path},
    preferences::preferred_runtime,
};
use crate::core::config::ServerConfig;
use std::path::PathBuf;

pub struct SelectedRuntime {
    pub id: &'static str,
    pub executable: PathBuf,
    pub gpu_layers: Option<i32>,
    pub fallback_reason: Option<String>,
}

fn candidates(prism: bool, prefer_cpu: bool) -> &'static [&'static str] {
    match (prism, prefer_cpu) {
        (true, true) => &["prism-cpu", "prism-cuda", "prism-rocm", "prism-vulkan"],
        (true, false) => &["prism-cuda", "prism-rocm", "prism-vulkan", "prism-cpu"],
        (false, true) => &["llama-cpu", "llama-cuda", "llama-rocm", "llama-vulkan"],
        (false, false) => &["llama-cuda", "llama-rocm", "llama-vulkan", "llama-cpu"],
    }
}

fn usable(runtime: &RuntimeSpec, executable: &std::path::Path, cpu_only: bool) -> bool {
    runtime.accelerator == "cpu"
        || (cpu_only && runtime.id == "llama-cuda")
        || available_gpu(runtime, executable)
}

fn candidate_order(prism: bool, cpu_only: bool, preferred: &str) -> Vec<&'static str> {
    let choices = candidates(prism, cpu_only);
    let mut order = Vec::with_capacity(choices.len());
    if let Ok(runtime) = spec(preferred)
        && (runtime.engine == "PrismML") == prism
        && (!cpu_only || runtime.accelerator == "cpu")
    {
        order.push(runtime.id);
    }
    for id in choices {
        if !order.contains(id) {
            order.push(id);
        }
    }
    order
}

fn fallback_reason(preferred: &str, selected: &str) -> Option<String> {
    if preferred == "auto" || preferred == selected {
        return None;
    }
    let preferred_name = spec(preferred)
        .map(|runtime| runtime.name)
        .unwrap_or(preferred);
    let selected_name = spec(selected)
        .map(|runtime| runtime.name)
        .unwrap_or(selected);
    Some(format!(
        "Preferred {preferred_name} was not compatible or available for this load; using {selected_name}."
    ))
}

pub fn select_runtime(config: &ServerConfig) -> Result<SelectedRuntime, String> {
    let prism = is_prism_model(&config.model_path, &config.model_name, &config.quantization);
    let cpu_only = config.gpu_layers == Some(0);
    let preferred = preferred_runtime(prism)?;

    // The model determines the engine, while Settings > Runtimes determines
    // its preferred installed accelerator. Legacy per-model IDs are ignored.
    for id in candidate_order(prism, cpu_only, &preferred) {
        let runtime = spec(id)?;
        let Some(executable) = installed_path(runtime)? else {
            continue;
        };
        if !usable(runtime, &executable, cpu_only) {
            continue;
        }
        let cpu_fallback = cpu_only || runtime.accelerator == "cpu";
        return Ok(SelectedRuntime {
            id: runtime.id,
            executable,
            gpu_layers: if cpu_fallback {
                Some(0)
            } else {
                config.gpu_layers
            },
            fallback_reason: fallback_reason(&preferred, runtime.id),
        });
    }

    if !prism {
        // The bundled CUDA binary can also run CPU-only, even on machines
        // without NVIDIA hardware. Never pass a nonzero offload count to it.
        let runtime = spec("llama-cuda")?;
        if let Some(executable) = installed_path(runtime)? {
            return Ok(SelectedRuntime {
                id: runtime.id,
                executable,
                gpu_layers: Some(0),
                fallback_reason: fallback_reason(&preferred, runtime.id),
            });
        }
    }

    Err(if prism {
        "Bonsai needs PrismML. Install a compatible PrismML runtime in Settings > Runtimes"
            .to_string()
    } else {
        "No compatible runtime installed. Install Vulkan, ROCm, or CPU in Settings > Runtimes"
            .to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prioritizes_gpu_and_cpu_by_request() {
        assert_eq!(candidates(false, false)[0], "llama-cuda");
        assert_eq!(candidates(false, true)[0], "llama-cpu");
        assert_eq!(candidates(true, false)[0], "prism-cuda");
        assert_eq!(candidates(true, true)[0], "prism-cpu");
    }

    #[test]
    fn preferred_runtime_is_first_only_for_its_engine() {
        assert_eq!(
            candidate_order(false, false, "llama-vulkan"),
            vec!["llama-vulkan", "llama-cuda", "llama-rocm", "llama-cpu"]
        );
        assert_eq!(
            candidate_order(true, false, "llama-vulkan"),
            candidates(true, false)
        );
        assert_eq!(
            candidate_order(false, false, "auto"),
            candidates(false, false)
        );
    }

    #[test]
    fn cpu_request_never_prioritizes_gpu_preference() {
        assert_eq!(
            candidate_order(false, true, "llama-vulkan"),
            candidates(false, true)
        );
        assert_eq!(candidate_order(false, true, "llama-cpu")[0], "llama-cpu");
    }

    #[test]
    fn only_real_fallbacks_have_explanations() {
        assert!(fallback_reason("auto", "llama-cpu").is_none());
        assert!(fallback_reason("llama-cpu", "llama-cpu").is_none());
        assert!(
            fallback_reason("llama-vulkan", "llama-cpu")
                .unwrap()
                .contains("using llama.cpp CPU")
        );
    }
}
