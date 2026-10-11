use crate::core::{
    backends::ManagedInference,
    config::{ServerConfig, SpeculativeMode},
    process::hide_console,
};
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};

const MAX_LOG_LINES: usize = 2_000;

type SharedLogs = Arc<Mutex<VecDeque<String>>>;

pub struct LlamaCppInstance {
    child: Child,
    logs: SharedLogs,
}

impl ManagedInference for LlamaCppInstance {
    fn pid(&self) -> u32 {
        self.child.id()
    }

    fn stop(&mut self) -> Result<(), String> {
        if self.is_running()? {
            self.child
                .kill()
                .map_err(|error| format!("failed to stop llama-server: {error}"))?;
            self.child
                .wait()
                .map_err(|error| format!("failed to wait for llama-server shutdown: {error}"))?;
        }

        Ok(())
    }

    fn is_running(&mut self) -> Result<bool, String> {
        self.child
            .try_wait()
            .map(|status| status.is_none())
            .map_err(|error| format!("failed to check llama-server: {error}"))
    }

    fn logs(&self) -> Vec<String> {
        let Ok(logs) = self.logs.lock() else {
            return vec!["[tidestudio] failed to read server logs".to_string()];
        };

        logs.iter().cloned().collect()
    }
}

pub fn spawn_llama_server(
    executable: &Path,
    config: &ServerConfig,
) -> Result<LlamaCppInstance, String> {
    let model_path = Path::new(&config.model_path);

    if !model_path.is_file() {
        return Err(format!("model does not exist: {}", model_path.display()));
    }

    if config.gpu_layers.is_some_and(|layers| layers > 0) {
        ensure_cuda_available(executable)?;
    }

    let mut command = Command::new(executable);
    command
        .arg("--model")
        .arg(&config.model_path)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(config.port.to_string())
        .arg("--alias")
        .arg(&config.model_id)
        .arg("--no-webui")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(context_size) = config.context_size {
        command.arg("--ctx-size").arg(context_size.to_string());
    }

    if let Some(gpu_layers) = config.gpu_layers {
        command.arg("--gpu-layers").arg(gpu_layers.to_string());
    }

    add_load_tuning_args(&mut command, config);

    if config.flash_attention {
        command.arg("--flash-attn").arg("on");
    }

    match config.model_category.as_str() {
        "LLM" => {
            add_prompt_args(&mut command, config);
            if config.speculative_mode == SpeculativeMode::Mtp && !config.supports_mtp {
                return Err("MTP speculative decoding is not supported by this model".to_string());
            }
            add_speculative_args(&mut command, config)?;
        }
        "Embedding" => {
            command.arg("--embeddings");
            if config.embedding_pooling != "model" {
                command.arg("--pooling").arg(&config.embedding_pooling);
            }
        }
        "Drafter" => {}
        "DECISION" => add_decision_runtime_args(&mut command, config),
        _ => {}
    }

    command.args(&config.extra_args);
    hide_console(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to start llama-server: {error}"))?;

    let logs = Arc::new(Mutex::new(VecDeque::with_capacity(MAX_LOG_LINES)));

    if let Some(stdout) = child.stdout.take() {
        pipe_logs(stdout, Arc::clone(&logs), "stdout");
    }

    if let Some(stderr) = child.stderr.take() {
        pipe_logs(stderr, Arc::clone(&logs), "stderr");
    }

    Ok(LlamaCppInstance { child, logs })
}

fn add_load_tuning_args(command: &mut Command, config: &ServerConfig) {
    if let Some(threads) = config.cpu_threads {
        command.arg("--threads").arg(threads.to_string());
    }
    if config.model_category != "DECISION" {
        if let Some(batch_size) = config.batch_size {
            command.arg("--batch-size").arg(batch_size.to_string());
        }
        if let Some(micro_batch_size) = config.micro_batch_size {
            command
                .arg("--ubatch-size")
                .arg(micro_batch_size.to_string());
        }
        if let Some(parallel_slots) = config.parallel_slots {
            command.arg("--parallel").arg(parallel_slots.to_string());
        }
    }
    if !config.kv_cache_offload {
        command.arg("--no-kv-offload");
    }
    if let Some(base) = config.rope_frequency_base {
        command.arg("--rope-freq-base").arg(base.to_string());
    }
    if let Some(scale) = config.rope_frequency_scale {
        command.arg("--rope-freq-scale").arg(scale.to_string());
    }
}

fn ensure_cuda_available(executable: &Path) -> Result<(), String> {
    let mut command = Command::new(executable);
    command.arg("--list-devices");
    hide_console(&mut command);

    let output = command
        .output()
        .map_err(|error| format!("failed to inspect llama.cpp GPU devices: {error}"))?;
    let device_list = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if output.status.success()
        && (device_list.contains("CUDA0") || device_list.to_ascii_lowercase().contains("nvidia"))
    {
        return Ok(());
    }

    Err(
        "GPU offload was requested, but the bundled llama.cpp CUDA backend did not expose an NVIDIA device. Run `npm run prepare:llama` to repair the CUDA runtime."
            .to_string(),
    )
}

fn add_decision_runtime_args(command: &mut Command, config: &ServerConfig) {
    let encoder_batch = config.context_size.unwrap_or(8_192).clamp(1, 8_192);
    command
        .arg("--parallel")
        .arg("1")
        .arg("--batch-size")
        .arg(config.batch_size.unwrap_or(encoder_batch).to_string())
        .arg("--ubatch-size")
        .arg(config.micro_batch_size.unwrap_or(encoder_batch).to_string());
}

fn add_prompt_args(command: &mut Command, config: &ServerConfig) {
    let chat_template = config.chat_template.trim();

    if !chat_template.is_empty() {
        command.arg("--chat-template").arg(chat_template);
    }
}

fn add_speculative_args(command: &mut Command, config: &ServerConfig) -> Result<(), String> {
    match config.speculative_mode {
        SpeculativeMode::None => return Ok(()),
        SpeculativeMode::Mtp => {
            command.arg("--spec-type").arg("draft-mtp");
        }
        SpeculativeMode::Draft => {
            let draft_model_path = config.draft_model_path.trim();

            if draft_model_path.is_empty() {
                return Err(
                    "draft model path is required when speculative mode is Draft".to_string(),
                );
            }

            let draft_model = Path::new(draft_model_path);
            if !draft_model.is_file() {
                return Err(format!(
                    "draft model does not exist: {}",
                    draft_model.display()
                ));
            }

            command
                .arg("--spec-type")
                .arg("draft-simple")
                .arg("--spec-draft-model")
                .arg(draft_model_path);

            if let Some(draft_gpu_layers) = config.draft_gpu_layers {
                command
                    .arg("--spec-draft-ngl")
                    .arg(draft_gpu_layers.to_string());
            }
        }
    }

    if let Some(draft_max_tokens) = config.draft_max_tokens {
        command
            .arg("--spec-draft-n-max")
            .arg(draft_max_tokens.to_string());
    }

    if let Some(draft_min_tokens) = config.draft_min_tokens {
        command
            .arg("--spec-draft-n-min")
            .arg(draft_min_tokens.to_string());
    }

    if let Some(draft_min_probability) = config.draft_min_probability {
        command
            .arg("--spec-draft-p-min")
            .arg(draft_min_probability.to_string());
    }

    Ok(())
}

fn pipe_logs<R>(stream: R, logs: SharedLogs, source: &'static str)
where
    R: std::io::Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = BufReader::new(stream);

        for line in reader.lines() {
            let Ok(line) = line else {
                break;
            };

            let Ok(mut buffer) = logs.lock() else {
                break;
            };

            if buffer.len() >= MAX_LOG_LINES {
                buffer.pop_front();
            }

            buffer.push_back(format!("[{source}] {line}"));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn model_config() -> ServerConfig {
        serde_json::from_value(json!({ "modelPath": "test.gguf" }))
            .expect("minimal model config should deserialize")
    }

    fn command_args(command: &Command) -> Vec<String> {
        command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn launch_tuning_maps_to_llama_flags() {
        let mut config = model_config();
        config.cpu_threads = Some(12);
        config.batch_size = Some(2048);
        config.micro_batch_size = Some(512);
        config.parallel_slots = Some(4);
        config.kv_cache_offload = false;
        config.rope_frequency_base = Some(10000.0);
        config.rope_frequency_scale = Some(2.0);

        let mut command = Command::new("llama-server");
        add_load_tuning_args(&mut command, &config);

        assert_eq!(
            command_args(&command),
            vec![
                "--threads",
                "12",
                "--batch-size",
                "2048",
                "--ubatch-size",
                "512",
                "--parallel",
                "4",
                "--no-kv-offload",
                "--rope-freq-base",
                "10000",
                "--rope-freq-scale",
                "2",
            ]
        );
    }

    #[test]
    fn auto_defaults_do_not_override_runtime_and_decision_keeps_one_slot() {
        let mut config = model_config();
        let mut command = Command::new("llama-server");
        add_load_tuning_args(&mut command, &config);
        assert!(command_args(&command).is_empty());

        config.model_category = "DECISION".to_string();
        config.parallel_slots = Some(4);
        config.context_size = Some(4096);
        config.batch_size = Some(1024);
        config.micro_batch_size = Some(256);
        let mut command = Command::new("llama-server");
        add_load_tuning_args(&mut command, &config);
        add_decision_runtime_args(&mut command, &config);
        assert_eq!(
            command_args(&command),
            vec![
                "--parallel",
                "1",
                "--batch-size",
                "1024",
                "--ubatch-size",
                "256",
            ]
        );
    }
}
