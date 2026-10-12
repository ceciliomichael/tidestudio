use super::catalog::{RUNTIMES, RuntimeInfo, RuntimeProgress, RuntimeSpec, spec};
use crate::core::{
    backends::llama_cpp::resolve_llama_server, paths::display_path, process::hide_console,
};
use reqwest::blocking::Client;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env,
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use zip::ZipArchive;

static ACTIVE_INSTALLS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
static GPU_NAMES: OnceLock<Mutex<Option<(Instant, String)>>> = OnceLock::new();

struct InstallGuard(String, Arc<AtomicBool>);

impl InstallGuard {
    fn acquire(id: &str) -> Result<Self, String> {
        let mut active = ACTIVE_INSTALLS
            .get_or_init(|| Mutex::new(HashMap::new()))
            .lock()
            .map_err(|_| "runtime install lock poisoned")?;
        if active.contains_key(id) {
            return Err(format!("{id} is already installing"));
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        active.insert(id.to_string(), Arc::clone(&cancelled));
        Ok(Self(id.to_string(), cancelled))
    }
}

impl Drop for InstallGuard {
    fn drop(&mut self) {
        if let Some(active) = ACTIVE_INSTALLS.get()
            && let Ok(mut active) = active.lock()
        {
            active.remove(&self.0);
        }
    }
}

pub fn cancel_install(id: &str) -> Result<(), String> {
    let active = ACTIVE_INSTALLS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| "runtime install lock poisoned")?;
    let cancelled = active.get(id).ok_or("runtime is not installing")?;
    cancelled.store(true, Ordering::Release);
    Ok(())
}

fn root() -> Result<PathBuf, String> {
    let profile = env::var_os("USERPROFILE").ok_or("USERPROFILE is unavailable")?;
    Ok(PathBuf::from(profile).join(".tidestudio").join("runtimes"))
}

fn runtime_path(runtime: &RuntimeSpec) -> Result<PathBuf, String> {
    Ok(root()?.join(runtime.id).join(runtime.version))
}

pub fn installed_path(runtime: &RuntimeSpec) -> Result<Option<PathBuf>, String> {
    if runtime.id == "llama-cuda" {
        return resolve_llama_server().map(Some);
    }
    let dir = runtime_path(runtime)?;
    let file = dir.join("llama-server.exe");
    let stamp = dir.join(".tidestudio-runtime");
    if stamp.is_file()
        && fs::read_to_string(stamp).ok().as_deref() == Some(runtime.version)
        && valid_executable(&file)
    {
        return Ok(Some(file));
    }
    Ok(None)
}

fn valid_executable(file: &Path) -> bool {
    let Ok(meta) = fs::metadata(file) else {
        return false;
    };
    if !meta.is_file() || meta.len() < 1024 {
        return false;
    }
    let Ok(mut handle) = File::open(file) else {
        return false;
    };
    let mut signature = [0_u8; 2];
    handle.read_exact(&mut signature).is_ok() && &signature == b"MZ"
}

fn output_with_timeout(cmd: &mut Command, timeout: Duration) -> Option<Output> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::null());
    let mut child = cmd.spawn().ok()?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return child.wait_with_output().ok(),
            Ok(None) if started.elapsed() < timeout => thread::sleep(Duration::from_millis(40)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

fn gpu_names() -> String {
    let cache = GPU_NAMES.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock()
        && let Some((checked, names)) = guard.as_ref()
        && checked.elapsed() < Duration::from_secs(if names.is_empty() { 15 } else { 300 })
    {
        return names.clone();
    }
    let names = if cfg!(windows) {
        let mut cmd = Command::new("powershell.exe");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue).Name",
        ]);
        hide_console(&mut cmd);
        output_with_timeout(&mut cmd, Duration::from_secs(4))
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).to_ascii_lowercase())
            .unwrap_or_default()
    } else {
        String::new()
    };
    if let Ok(mut guard) = cache.lock() {
        *guard = Some((Instant::now(), names.clone()));
    }
    names
}

fn compatible(runtime: &RuntimeSpec) -> bool {
    if !cfg!(all(windows, target_arch = "x86_64")) {
        return false;
    }
    let gpu = gpu_names();
    match runtime.accelerator {
        "cpu" => true,
        "cuda" => gpu.contains("nvidia"),
        "rocm" => gpu.contains("amd") || gpu.contains("radeon"),
        "vulkan" => {
            !gpu.trim().is_empty() && !gpu.lines().all(|name| name.contains("microsoft basic"))
        }
        _ => false,
    }
}

fn directory_size(path: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                directory_size(&path)
            } else {
                entry.metadata().map(|info| info.len()).unwrap_or(0)
            }
        })
        .sum()
}

pub fn list_runtimes() -> Result<Vec<RuntimeInfo>, String> {
    RUNTIMES
        .iter()
        .map(|runtime| {
            let installed = installed_path(runtime)?.is_some();
            let outdated =
                runtime.id != "llama-cuda" && !installed && root()?.join(runtime.id).is_dir();
            let compatible = compatible(runtime);
            let size_bytes = if runtime.id == "llama-cuda" {
                0
            } else {
                directory_size(&runtime_path(runtime)?)
            };
            let detail = if runtime.id == "llama-cuda" {
                "Bundled with TideStudio".to_string()
            } else if !compatible {
                format!(
                    "{} hardware not detected; install only if supported",
                    runtime.accelerator
                )
            } else {
                format!("Windows x64 • {}", runtime.version)
            };
            Ok(RuntimeInfo {
                id: runtime.id.to_string(),
                name: runtime.name.to_string(),
                engine: runtime.engine.to_string(),
                accelerator: runtime.accelerator.to_string(),
                version: runtime.version.to_string(),
                installed,
                outdated,
                compatible,
                detail,
                size_bytes,
            })
        })
        .collect()
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("TideStudio-RuntimeManager/0.1")
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|error| error.to_string())
}

fn expected_hash(client: &Client, runtime: &RuntimeSpec, filename: &str) -> Result<String, String> {
    if let Some(hash) = runtime
        .archives
        .iter()
        .find(|asset| asset.filename == filename)
        .and_then(|asset| asset.sha256)
    {
        return Ok(hash.to_string());
    }

    // PrismML's pinned release publishes SHA-256 asset digests through GitHub's
    // release API. Refuse files without a published digest.
    let url = format!(
        "https://api.github.com/repos/PrismML-Eng/llama.cpp/releases/tags/{}",
        runtime.version
    );
    let response: Value = client
        .get(url)
        .send()
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.json())
        .map_err(|error| format!("failed to verify PrismML release: {error}"))?;
    let digest = response["assets"]
        .as_array()
        .and_then(|assets| {
            assets
                .iter()
                .find(|asset| asset["name"].as_str() == Some(filename))
        })
        .and_then(|asset| asset["digest"].as_str())
        .and_then(|digest| digest.strip_prefix("sha256:"))
        .filter(|digest| digest.len() == 64 && digest.bytes().all(|ch| ch.is_ascii_hexdigit()))
        .ok_or_else(|| format!("no published SHA-256 digest for {filename}"))?;
    Ok(digest.to_ascii_lowercase())
}

struct ProgressContext<'a> {
    archive_number: usize,
    archive_count: usize,
    archive_name: Option<&'a str>,
    completed_bytes: u64,
    overall_total: Option<u64>,
    file_total: Option<u64>,
}

fn send_progress(
    app: &AppHandle,
    id: &str,
    downloaded: u64,
    context: &ProgressContext<'_>,
    status: &'static str,
) {
    let _ = app.emit(
        "runtime-install-progress",
        RuntimeProgress {
            id: id.to_string(),
            downloaded_bytes: context.completed_bytes.saturating_add(downloaded),
            total_bytes: context.overall_total,
            archive_number: context.archive_number,
            archive_count: context.archive_count,
            archive_name: context.archive_name.map(str::to_string),
            file_downloaded_bytes: downloaded,
            file_total_bytes: context.file_total,
            status,
        },
    );
}

fn archive_url(runtime: &RuntimeSpec, filename: &str) -> String {
    let source = if runtime.engine == "PrismML" {
        "PrismML-Eng"
    } else {
        "ggml-org"
    };
    format!(
        "https://github.com/{source}/llama.cpp/releases/download/{}/{}",
        runtime.version, filename
    )
}

fn archive_lengths(client: &Client, runtime: &RuntimeSpec) -> Vec<Option<u64>> {
    runtime
        .archives
        .iter()
        .map(|asset| {
            client
                .head(archive_url(runtime, asset.filename))
                .timeout(Duration::from_secs(6))
                .send()
                .ok()
                .filter(|response| response.status().is_success())
                .and_then(|response| response.content_length())
                .filter(|length| *length > 0)
        })
        .collect()
}

fn combined_total(lengths: &[Option<u64>]) -> Option<u64> {
    lengths
        .iter()
        .try_fold(0_u64, |total, size| total.checked_add((*size)?))
        .filter(|total| *total > 0)
}

fn download_archive(
    client: &Client,
    app: &AppHandle,
    runtime: &RuntimeSpec,
    filename: &str,
    expected: &str,
    target: &Path,
    cancelled: &AtomicBool,
    context: ProgressContext<'_>,
) -> Result<u64, String> {
    let url = archive_url(runtime, filename);
    let mut response = client
        .get(url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("failed to download {filename}: {error}"))?;
    let total = response.content_length();
    let context = ProgressContext {
        file_total: total,
        ..context
    };
    send_progress(app, runtime.id, 0, &context, "downloading");
    let mut output = File::create(target).map_err(|error| error.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 128 * 1024];
    let mut downloaded = 0_u64;
    let mut last_emit = Instant::now();
    loop {
        if cancelled.load(Ordering::Acquire) {
            return Err("runtime installation cancelled".to_string());
        }
        let count = response
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        output
            .write_all(&buffer[..count])
            .map_err(|error| error.to_string())?;
        hash.update(&buffer[..count]);
        downloaded += count as u64;
        if last_emit.elapsed() >= Duration::from_millis(200) {
            send_progress(app, runtime.id, downloaded, &context, "downloading");
            last_emit = Instant::now();
        }
    }
    output.flush().map_err(|error| error.to_string())?;
    if let Some(expected_size) = total
        && downloaded != expected_size
    {
        return Err(format!("incomplete download of {filename}"));
    }
    send_progress(app, runtime.id, downloaded, &context, "verifying");
    let actual = format!("{:x}", hash.finalize());
    if actual != expected {
        return Err(format!(
            "SHA-256 mismatch for {filename}; archive was not installed"
        ));
    }
    send_progress(app, runtime.id, downloaded, &context, "extracting");
    Ok(downloaded)
}

fn extract_zip(archive_path: &Path, dest: &Path, cancelled: &AtomicBool) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        if cancelled.load(Ordering::Acquire) {
            return Err("runtime installation cancelled".to_string());
        }
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| "unsafe path in runtime archive".to_string())?
            .to_path_buf();
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err("runtime archive contains a symbolic link".to_string());
        }
        let target = dest.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|error| error.to_string())?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(target).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn install_runtime(app: &AppHandle, id: &str) -> Result<(), String> {
    let runtime = spec(id)?;
    if runtime.id == "llama-cuda" {
        return Err("The bundled CUDA runtime is managed by TideStudio updates".to_string());
    }
    if !compatible(runtime) {
        return Err(format!(
            "{} is not compatible with detected hardware",
            runtime.name
        ));
    }
    let guard = InstallGuard::acquire(id)?;
    if installed_path(runtime)?.is_some() {
        return Ok(());
    }
    let destination = runtime_path(runtime)?;
    if destination.exists() {
        return Err(
            "An incomplete runtime installation exists. Remove it before retrying".to_string(),
        );
    }
    let parent = destination
        .parent()
        .ok_or("runtime has no parent directory")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = parent.join(format!(".installing-{}", Uuid::new_v4()));
    fs::create_dir_all(&temporary).map_err(|error| error.to_string())?;
    let result = (|| {
        let client = http_client()?;
        let mut completed_bytes = 0_u64;
        let preparing = ProgressContext {
            archive_number: 0,
            archive_count: runtime.archives.len(),
            archive_name: None,
            completed_bytes: 0,
            overall_total: None,
            file_total: None,
        };
        send_progress(app, id, 0, &preparing, "preparing");
        let lengths = if runtime.archives.len() > 1 {
            archive_lengths(&client, runtime)
        } else {
            vec![None; runtime.archives.len()]
        };
        let overall_total = combined_total(&lengths);
        for (index, archive) in runtime.archives.iter().enumerate() {
            if guard.1.load(Ordering::Acquire) {
                return Err("runtime installation cancelled".to_string());
            }
            let expected = expected_hash(&client, runtime, archive.filename)?;
            let archive_path = temporary.join(format!("{index}.zip"));
            let downloaded = download_archive(
                &client,
                app,
                runtime,
                archive.filename,
                &expected,
                &archive_path,
                &guard.1,
                ProgressContext {
                    archive_number: index + 1,
                    archive_count: runtime.archives.len(),
                    archive_name: Some(archive.filename),
                    completed_bytes,
                    overall_total,
                    file_total: lengths[index],
                },
            )?;
            extract_zip(&archive_path, &temporary, &guard.1)?;
            fs::remove_file(archive_path).map_err(|error| error.to_string())?;
            completed_bytes = completed_bytes.saturating_add(downloaded);
        }
        send_progress(
            app,
            id,
            0,
            &ProgressContext {
                archive_number: runtime.archives.len(),
                archive_count: runtime.archives.len(),
                archive_name: None,
                completed_bytes,
                overall_total: Some(completed_bytes),
                file_total: None,
            },
            "installing",
        );
        if !valid_executable(&temporary.join("llama-server.exe")) {
            return Err("Downloaded runtime does not contain a valid llama-server.exe".to_string());
        }
        fs::write(temporary.join(".tidestudio-runtime"), runtime.version)
            .map_err(|error| error.to_string())?;
        fs::rename(&temporary, &destination).map_err(|error| error.to_string())?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&temporary);
    }
    let status = if result.is_ok() {
        "installed"
    } else if guard.1.load(Ordering::Acquire) {
        "cancelled"
    } else {
        "failed"
    };
    send_progress(
        app,
        id,
        0,
        &ProgressContext {
            archive_number: 0,
            archive_count: runtime.archives.len(),
            archive_name: None,
            completed_bytes: 0,
            overall_total: None,
            file_total: None,
        },
        status,
    );
    result
}

pub fn remove_runtime(id: &str) -> Result<(), String> {
    let runtime = spec(id)?;
    if runtime.id == "llama-cuda" {
        return Err("The bundled CUDA runtime cannot be removed".to_string());
    }
    let _guard = InstallGuard::acquire(id)?;
    let path = root()?.join(id);
    if path.exists() {
        fs::remove_dir_all(&path)
            .map_err(|error| format!("failed to remove {}: {error}", display_path(&path)))?;
    }
    Ok(())
}

pub fn available_gpu(runtime: &RuntimeSpec, executable: &Path) -> bool {
    if runtime.accelerator == "cpu" {
        return true;
    }
    if !compatible(runtime) {
        return false;
    }
    let mut command = Command::new(executable);
    command.arg("--list-devices");
    hide_console(&mut command);
    let Some(output) = output_with_timeout(&mut command, Duration::from_secs(6)) else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    let devices = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    has_gpu_device(runtime.accelerator, &devices)
}

fn has_gpu_device(accelerator: &str, devices: &str) -> bool {
    let devices = devices.to_ascii_lowercase();
    match accelerator {
        "cuda" => devices.contains("cuda0:"),
        "rocm" => devices.contains("hip0:") || devices.contains("rocm0:"),
        "vulkan" => devices.contains("vulkan0:"),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_installs_are_rejected_and_cancel_is_scoped() {
        let first = InstallGuard::acquire("llama-cpu").expect("first install");
        assert!(InstallGuard::acquire("llama-cpu").is_err());
        let other = InstallGuard::acquire("prism-cpu").expect("other install");
        cancel_install("llama-cpu").expect("cancel active download");
        assert!(first.1.load(Ordering::Acquire));
        assert!(!other.1.load(Ordering::Acquire));
        drop(first);
        drop(other);
        assert!(InstallGuard::acquire("llama-cpu").is_ok());
    }

    #[test]
    fn gpu_detection_requires_an_enumerated_device() {
        assert!(has_gpu_device("cuda", "CUDA0: NVIDIA RTX 4080"));
        assert!(has_gpu_device("rocm", "hip0: Radeon RX"));
        assert!(has_gpu_device("vulkan", "vulkan0: Intel Arc"));
        assert!(!has_gpu_device("cuda", "No CUDA capable devices found"));
        assert!(!has_gpu_device(
            "vulkan",
            "Vulkan backend installed, no devices"
        ));
    }

    #[test]
    fn combined_download_sizes_only_report_known_totals() {
        assert_eq!(combined_total(&[Some(300), Some(700)]), Some(1000));
        assert_eq!(combined_total(&[Some(300), None]), None);
        assert_eq!(combined_total(&[]), None);
        assert_eq!(combined_total(&[Some(u64::MAX), Some(1)]), None);
    }
}
