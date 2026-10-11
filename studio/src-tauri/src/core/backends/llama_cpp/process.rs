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
        .arg(encoder_batch.to_string())
        .arg("--ubatch-size")
        .arg(encoder_batch.to_string());
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
