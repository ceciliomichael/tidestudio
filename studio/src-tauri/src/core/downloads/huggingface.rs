use crate::core::models::{CapabilityHints, GgufInspection, inspect_gguf, resolve_models_dir};
use futures_util::StreamExt;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::{fs, io::AsyncWriteExt};

const HUGGING_FACE_BASE: &str = "https://huggingface.co";
const USER_AGENT: &str = "TideStudio/0.1";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HuggingFaceModelSummary {
    pub repo_id: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u64,
    pub last_modified: Option<String>,
    pub pipeline_tag: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HuggingFaceFile {
    pub filename: String,
    pub size_bytes: Option<u64>,
    pub quantization: Option<String>,
    pub is_mmproj: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HuggingFaceRepoDetails {
    pub repo_id: String,
    pub author: String,
    pub downloads: u64,
    pub likes: u64,
    pub last_modified: Option<String>,
    pub pipeline_tag: Option<String>,
    pub tags: Vec<String>,
    pub files: Vec<HuggingFaceFile>,
    pub readme: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub download_id: String,
    pub repo_id: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub status: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedModel {
    pub repo_id: String,
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub inspection: Option<GgufInspection>,
    pub inspection_error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawModel {
    id: String,
    author: Option<String>,
    downloads: Option<u64>,
    likes: Option<u64>,
    #[serde(rename = "lastModified")]
    last_modified: Option<String>,
    pipeline_tag: Option<String>,
    tags: Option<Vec<String>>,
    siblings: Option<Vec<RawSibling>>,
}

#[derive(Debug, Deserialize)]
struct RawSibling {
    rfilename: String,
    size: Option<u64>,
    lfs: Option<RawLfs>,
}

#[derive(Debug, Deserialize)]
struct RawLfs {
    size: Option<u64>,
}

pub async fn search_models(query: &str) -> Result<Vec<HuggingFaceModelSummary>, String> {
    let client = client()?;
    let response = client
        .get(format!("{HUGGING_FACE_BASE}/api/models"))
        .query(&[
            ("search", query),
            ("filter", "gguf"),
            ("sort", "downloads"),
            ("direction", "-1"),
            ("limit", "40"),
            ("full", "true"),
        ])
        .send()
        .await
        .map_err(|error| format!("Hugging Face search failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Hugging Face search failed: {error}"))?;

    let models = response
        .json::<Vec<RawModel>>()
        .await
        .map_err(|error| format!("failed to decode Hugging Face search results: {error}"))?;

    Ok(models
        .into_iter()
        .filter(is_likely_llama_cpp_model)
        .map(summary_from_raw)
        .collect())
}

pub async fn model_files(repo_id: &str) -> Result<HuggingFaceRepoDetails, String> {
    validate_repo_id(repo_id)?;

    let client = client()?;
    let response = client
        .get(format!("{HUGGING_FACE_BASE}/api/models/{repo_id}"))
        .query(&[("blobs", "true")])
        .send()
        .await
        .map_err(|error| format!("failed to fetch Hugging Face repository: {error}"))?
        .error_for_status()
        .map_err(|error| format!("failed to fetch Hugging Face repository: {error}"))?;

    let model = response
        .json::<RawModel>()
        .await
        .map_err(|error| format!("failed to decode Hugging Face repository: {error}"))?;

    let readme = fetch_readme(&client, repo_id).await;
    let summary = summary_from_raw_ref(&model);
    let mut files = model
        .siblings
        .unwrap_or_default()
        .into_iter()
        .filter(|file| file.rfilename.to_lowercase().ends_with(".gguf"))
        .map(|file| HuggingFaceFile {
            quantization: infer_quantization(&file.rfilename),
            is_mmproj: file.rfilename.to_lowercase().contains("mmproj"),
            size_bytes: file.size.or_else(|| file.lfs.and_then(|lfs| lfs.size)),
            filename: file.rfilename,
        })
        .collect::<Vec<_>>();

    files.sort_by(|left, right| {
        left.is_mmproj.cmp(&right.is_mmproj).then_with(|| {
            left.filename
                .to_lowercase()
                .cmp(&right.filename.to_lowercase())
        })
    });

    Ok(HuggingFaceRepoDetails {
        repo_id: summary.repo_id,
        author: summary.author,
        downloads: summary.downloads,
        likes: summary.likes,
        last_modified: summary.last_modified,
        pipeline_tag: summary.pipeline_tag,
        tags: summary.tags,
        files,
        readme,
    })
}

async fn fetch_readme(client: &Client, repo_id: &str) -> Option<String> {
    let response = client
        .get(format!("{HUGGING_FACE_BASE}/{repo_id}/raw/main/README.md"))
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let mut text = response.text().await.ok()?;
    const MAX_README_CHARS: usize = 120_000;

    if text.chars().count() > MAX_README_CHARS {
        text = text.chars().take(MAX_README_CHARS).collect();
    }

    Some(text)
}

pub async fn download_file(
    app: &AppHandle,
    repo_id: &str,
    filename: &str,
    tags: Vec<String>,
    pipeline_tag: Option<String>,
) -> Result<DownloadedModel, String> {
    validate_repo_id(repo_id)?;
    validate_gguf_filename(filename)?;

    let models_dir = resolve_models_dir()?;
    let destination_dir = destination_repo_dir(&models_dir, repo_id)?;
    fs::create_dir_all(&destination_dir)
        .await
        .map_err(|error| format!("failed to create model directory: {error}"))?;

    let leaf_name = Path::new(filename)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid Hugging Face filename".to_string())?;
    let destination = destination_dir.join(sanitize_component(leaf_name));
    let partial = destination.with_extension(format!(
        "{}.part",
        destination
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("gguf")
    ));

    let download_id = format!("{}::{}", repo_id, filename);
    let url = resolve_url(repo_id, filename)?;
    let client = client()?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("failed to start model download: {error}"))?
        .error_for_status()
        .map_err(|error| format!("failed to download model: {error}"))?;

    let total_bytes = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(&partial)
        .await
        .map_err(|error| format!("failed to create partial download: {error}"))?;
    let mut downloaded_bytes = 0_u64;

    emit_progress(
        app,
        DownloadProgress {
            download_id: download_id.clone(),
            repo_id: repo_id.to_string(),
            filename: filename.to_string(),
            downloaded_bytes,
            total_bytes,
            status: "downloading",
        },
    );

    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(chunk) => chunk,
            Err(error) => {
                let _ = fs::remove_file(&partial).await;
                return Err(format!("model download interrupted: {error}"));
            }
        };

        file.write_all(&chunk)
            .await
            .map_err(|error| format!("failed to write model download: {error}"))?;
        downloaded_bytes += chunk.len() as u64;

        emit_progress(
            app,
            DownloadProgress {
                download_id: download_id.clone(),
                repo_id: repo_id.to_string(),
                filename: filename.to_string(),
                downloaded_bytes,
                total_bytes,
                status: "downloading",
            },
        );
    }

    file.flush()
        .await
        .map_err(|error| format!("failed to flush model download: {error}"))?;
    drop(file);

    if fs::try_exists(&destination).await.unwrap_or(false) {
        fs::remove_file(&destination)
            .await
            .map_err(|error| format!("failed to replace existing model: {error}"))?;
    }

    fs::rename(&partial, &destination)
        .await
        .map_err(|error| format!("failed to finalize model download: {error}"))?;

    let inspection_result = inspect_gguf(
        &destination,
        CapabilityHints {
            repo_id,
            filename,
            tags: &tags,
            pipeline_tag: pipeline_tag.as_deref(),
        },
    );

    let (inspection, inspection_error) = match inspection_result {
        Ok(value) => (Some(value), None),
        Err(error) => (None, Some(error)),
    };

    emit_progress(
        app,
        DownloadProgress {
            download_id,
            repo_id: repo_id.to_string(),
            filename: filename.to_string(),
            downloaded_bytes,
            total_bytes: total_bytes.or(Some(downloaded_bytes)),
            status: "completed",
        },
    );

    Ok(DownloadedModel {
        repo_id: repo_id.to_string(),
        filename: filename.to_string(),
        path: destination.to_string_lossy().into_owned(),
        size_bytes: downloaded_bytes,
        inspection,
        inspection_error,
    })
}

fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| format!("failed to create HTTP client: {error}"))
}

fn summary_from_raw(model: RawModel) -> HuggingFaceModelSummary {
    summary_from_raw_ref(&model)
}

fn summary_from_raw_ref(model: &RawModel) -> HuggingFaceModelSummary {
    HuggingFaceModelSummary {
        repo_id: model.id.clone(),
        author: model
            .author
            .clone()
            .unwrap_or_else(|| model.id.split('/').next().unwrap_or("Unknown").to_string()),
        downloads: model.downloads.unwrap_or(0),
        likes: model.likes.unwrap_or(0),
        last_modified: model.last_modified.clone(),
        pipeline_tag: model.pipeline_tag.clone(),
        tags: model.tags.clone().unwrap_or_default(),
    }
}

fn is_likely_llama_cpp_model(model: &RawModel) -> bool {
    let pipeline = model
        .pipeline_tag
        .as_deref()
        .unwrap_or_default()
        .to_lowercase();
    let tags = model
        .tags
        .as_deref()
        .unwrap_or_default()
        .join(" ")
        .to_lowercase();

    let unsupported_pipeline = [
        "text-to-image",
        "image-to-image",
        "text-to-video",
        "audio-to-audio",
        "text-to-audio",
    ]
    .iter()
    .any(|value| pipeline == *value);

    !unsupported_pipeline && !tags.contains("comfyui")
}

fn resolve_url(repo_id: &str, filename: &str) -> Result<Url, String> {
    let mut url = Url::parse(HUGGING_FACE_BASE)
        .map_err(|error| format!("failed to construct Hugging Face URL: {error}"))?;

    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "failed to construct Hugging Face URL".to_string())?;

        for segment in repo_id.split('/') {
            segments.push(segment);
        }
        segments.push("resolve");
        segments.push("main");
        for segment in filename.split('/') {
            segments.push(segment);
        }
    }

    Ok(url)
}

fn destination_repo_dir(models_dir: &Path, repo_id: &str) -> Result<PathBuf, String> {
    let mut destination = models_dir.to_path_buf();

    for segment in repo_id.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("invalid Hugging Face repository id".to_string());
        }
        destination.push(sanitize_component(segment));
    }

    Ok(destination)
}

fn sanitize_component(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn validate_repo_id(repo_id: &str) -> Result<(), String> {
    let segments = repo_id.split('/').collect::<Vec<_>>();
    if segments.len() != 2
        || segments
            .iter()
            .any(|segment| segment.is_empty() || *segment == "." || *segment == "..")
    {
        return Err("invalid Hugging Face repository id".to_string());
    }

    Ok(())
}

fn validate_gguf_filename(filename: &str) -> Result<(), String> {
    if filename.split('/').any(|segment| segment == "..")
        || !filename.to_lowercase().ends_with(".gguf")
    {
        return Err("only GGUF files can be downloaded".to_string());
    }

    Ok(())
}

fn infer_quantization(filename: &str) -> Option<String> {
    let upper = filename.to_uppercase();
    const QUANTS: &[&str] = &[
        "IQ1_S", "IQ1_M", "IQ2_XXS", "IQ2_XS", "IQ2_S", "IQ2_M", "IQ3_XXS", "IQ3_XS", "IQ3_S",
        "IQ3_M", "IQ4_XS", "IQ4_NL", "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_1",
        "Q4_K_S", "Q4_K_M", "Q5_0", "Q5_1", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "BF16",
        "F32",
    ];

    QUANTS
        .iter()
        .find(|quant| upper.contains(**quant))
        .map(|value| (*value).to_string())
}

fn emit_progress(app: &AppHandle, progress: DownloadProgress) {
    let _ = app.emit("model-download-progress", progress);
}
