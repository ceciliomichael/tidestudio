use crate::core::{
    backends::ManagedInference,
    config::{ServerConfig, SpeculativeMode},
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

    let mut command = Command::new(executable);
    command
        .arg("--model")
        .arg(&config.model_path)
        .arg("--host")
        .arg(&config.host)
        .arg("--port")
        .arg(config.port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let api_key = config.api_key.trim();
    if !api_key.is_empty() {
        command.arg("--api-key").arg(api_key);
    }

    if let Some(context_size) = config.context_size {
        command.arg("--ctx-size").arg(context_size.to_string());
    }

    if let Some(gpu_layers) = config.gpu_layers {
        command.arg("--gpu-layers").arg(gpu_layers.to_string());
    }

    if config.flash_attention {
        command.arg("--flash-attn").arg("on");
    }

    add_prompt_args(&mut command, config);
    add_reasoning_args(&mut command, config);
    add_sampling_args(&mut command, config);
    add_speculative_args(&mut command, config)?;

    command.args(&config.extra_args);

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

fn add_prompt_args(command: &mut Command, config: &ServerConfig) {
    let chat_template = config.chat_template.trim();

    if !chat_template.is_empty() {
        command.arg("--chat-template").arg(chat_template);
    }
}

fn add_reasoning_args(command: &mut Command, config: &ServerConfig) {
    if config.thinking_enabled {
        command.arg("--reasoning").arg("on");

        command
            .arg("--reasoning-effort")
            .arg(config.reasoning_effort.trim());

        if let Some(reasoning_budget) = config.reasoning_budget {
            command
                .arg("--reasoning-budget")
                .arg(reasoning_budget.to_string());
        }

        if config.reasoning_preserve {
            command.arg("--reasoning-preserve");
        } else {
            command.arg("--no-reasoning-preserve");
        }
    } else {
        command.arg("--reasoning").arg("off");
    }
}

fn add_sampling_args(command: &mut Command, config: &ServerConfig) {
    if let Some(temperature) = config.temperature {
        command.arg("--temp").arg(temperature.to_string());
    }

    if let Some(top_k) = config.top_k {
        command.arg("--top-k").arg(top_k.to_string());
    }

    if let Some(top_p) = config.top_p {
        command.arg("--top-p").arg(top_p.to_string());
    }

    if let Some(min_p) = config.min_p {
        command.arg("--min-p").arg(min_p.to_string());
    }

    if let Some(typical_p) = config.typical_p {
        command.arg("--typical-p").arg(typical_p.to_string());
    }

    if let Some(seed) = config.seed {
        command.arg("--seed").arg(seed.to_string());
    }

    if let Some(repeat_penalty) = config.repeat_penalty {
        command
            .arg("--repeat-penalty")
            .arg(repeat_penalty.to_string());
    }

    if let Some(presence_penalty) = config.presence_penalty {
        command
            .arg("--presence-penalty")
            .arg(presence_penalty.to_string());
    }

    if let Some(frequency_penalty) = config.frequency_penalty {
        command
            .arg("--frequency-penalty")
            .arg(frequency_penalty.to_string());
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
