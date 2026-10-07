use crate::core::{backends::ManagedInference, config::ServerConfig};
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

    if let Some(context_size) = config.context_size {
        command.arg("--ctx-size").arg(context_size.to_string());
    }

    if let Some(gpu_layers) = config.gpu_layers {
        command.arg("--gpu-layers").arg(gpu_layers.to_string());
    }

    if let Some(temperature) = config.temperature {
        command.arg("--temp").arg(temperature.to_string());
    }

    if config.flash_attention {
        command.arg("--flash-attn").arg("on");
    }

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
