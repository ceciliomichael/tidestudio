use serde::Serialize;

pub const UPSTREAM_TAG: &str = "b11429";
pub const PRISM_TAG: &str = "prism-b10743-adfffbe";

#[derive(Clone, Copy)]
pub struct RuntimeSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub engine: &'static str,
    pub accelerator: &'static str,
    pub version: &'static str,
    pub archives: &'static [Archive],
}

#[derive(Clone, Copy)]
pub struct Archive {
    pub filename: &'static str,
    pub sha256: Option<&'static str>,
}

const CPU: Archive = Archive {
    filename: "llama-b11429-bin-win-cpu-x64.zip",
    sha256: Some("1283323272b04cd07905816a597a0da810918102de958f4ff6f7bbaa70ed2efe"),
};
const VULKAN: Archive = Archive {
    filename: "llama-b11429-bin-win-vulkan-x64.zip",
    sha256: Some("1bfe78ad9168b79fa02bf67f6af9f5e17a966d824d77238517f7bef12ac73b36"),
};
const ROCM: Archive = Archive {
    filename: "llama-b11429-bin-win-rocm-10.0-x64.zip",
    sha256: Some("289a8453bb222f0648f91eff3d55133c934119c841eb369b704aafae1d4719d2"),
};
const PRISM_CPU: Archive = Archive {
    filename: "llama-prism-b10743-adfffbe-bin-win-cpu-x64.zip",
    sha256: None,
};
const PRISM_VULKAN: Archive = Archive {
    filename: "llama-prism-b10743-adfffbe-bin-win-vulkan-x64.zip",
    sha256: None,
};
const PRISM_CUDA: Archive = Archive {
    filename: "llama-prism-b10743-adfffbe-bin-win-cuda-12.4-x64.zip",
    sha256: None,
};
const PRISM_CUDART: Archive = Archive {
    filename: "cudart-llama-bin-win-cuda-12.4-x64.zip",
    sha256: None,
};
const PRISM_ROCM: Archive = Archive {
    filename: "llama-prism-b10743-adfffbe-bin-win-hip-radeon-x64.zip",
    sha256: None,
};

pub const RUNTIMES: &[RuntimeSpec] = &[
    RuntimeSpec {
        id: "llama-cuda",
        name: "llama.cpp CUDA",
        engine: "llama.cpp",
        accelerator: "cuda",
        version: UPSTREAM_TAG,
        archives: &[],
    },
    RuntimeSpec {
        id: "llama-vulkan",
        name: "llama.cpp Vulkan",
        engine: "llama.cpp",
        accelerator: "vulkan",
        version: UPSTREAM_TAG,
        archives: &[VULKAN],
    },
    RuntimeSpec {
        id: "llama-rocm",
        name: "llama.cpp ROCm",
        engine: "llama.cpp",
        accelerator: "rocm",
        version: UPSTREAM_TAG,
        archives: &[ROCM],
    },
    RuntimeSpec {
        id: "llama-cpu",
        name: "llama.cpp CPU",
        engine: "llama.cpp",
        accelerator: "cpu",
        version: UPSTREAM_TAG,
        archives: &[CPU],
    },
    RuntimeSpec {
        id: "prism-cuda",
        name: "PrismML CUDA",
        engine: "PrismML",
        accelerator: "cuda",
        version: PRISM_TAG,
        archives: &[PRISM_CUDA, PRISM_CUDART],
    },
    RuntimeSpec {
        id: "prism-rocm",
        name: "PrismML ROCm",
        engine: "PrismML",
        accelerator: "rocm",
        version: PRISM_TAG,
        archives: &[PRISM_ROCM],
    },
    RuntimeSpec {
        id: "prism-vulkan",
        name: "PrismML Vulkan",
        engine: "PrismML",
        accelerator: "vulkan",
        version: PRISM_TAG,
        archives: &[PRISM_CPU, PRISM_VULKAN],
    },
    RuntimeSpec {
        id: "prism-cpu",
        name: "PrismML CPU",
        engine: "PrismML",
        accelerator: "cpu",
        version: PRISM_TAG,
        archives: &[PRISM_CPU],
    },
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub accelerator: String,
    pub version: String,
    pub installed: bool,
    pub outdated: bool,
    pub compatible: bool,
    pub detail: String,
    pub size_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProgress {
    pub id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub archive_number: usize,
    pub archive_count: usize,
    pub archive_name: Option<String>,
    pub file_downloaded_bytes: u64,
    pub file_total_bytes: Option<u64>,
    pub status: &'static str,
}

pub fn spec(id: &str) -> Result<&'static RuntimeSpec, String> {
    RUNTIMES
        .iter()
        .find(|spec| spec.id == id)
        .ok_or_else(|| format!("unknown runtime: {id}"))
}

pub fn is_prism_model(model_path: &str, model_name: &str, quantization: &str) -> bool {
    let path = model_path.to_ascii_lowercase();
    let name = model_name.to_ascii_lowercase();
    let quant = quantization.to_ascii_uppercase();
    path.contains("bonsai")
        || name.contains("bonsai")
        || matches!(quant.as_str(), "PTQ1_0" | "PQ2_0" | "Q1_0" | "Q2_0")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_specialized_quantizations_need_prism() {
        assert!(is_prism_model("normal.gguf", "", "PTQ1_0"));
        assert!(is_prism_model("Ternary-Bonsai.gguf", "", "Unknown"));
        assert!(!is_prism_model("llama-q4.gguf", "", "Q4_K_M"));
    }

    #[test]
    fn all_optional_runtimes_have_downloads() {
        assert!(
            RUNTIMES
                .iter()
                .skip(1)
                .all(|runtime| !runtime.archives.is_empty())
        );
    }
}
