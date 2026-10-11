use super::huggingface::{
    DownloadProgress, DownloadedModel, HuggingFaceFile, HuggingFaceModelSummary,
    HuggingFaceRepoDetails,
};
use super::{DownloadGuard, STOPPED_DOWNLOAD, cleanup_partial};
use crate::core::models::{CapabilityHints, inspect_gguf, resolve_models_dir};
use futures_util::{StreamExt, future::Abortable};
use reqwest::{Client, Url};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::{fs, io::AsyncWriteExt};

const MODELSCOPE_BASE: &str = "https://modelscope.cn";
const USER_AGENT: &str = "TideStudio/0.1";

#[derive(Debug, Deserialize)]
struct SearchEnvelope {
    data: SearchData,
}

#[derive(Debug, Deserialize)]
struct SearchData {
    models: Vec<SearchModel>,
}

#[derive(Debug, Deserialize)]
struct SearchModel {
    id: String,
    downloads: Option<u64>,
    likes: Option<u64>,
    last_modified: Option<String>,
    tags: Option<Vec<String>>,
    tasks: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct DetailEnvelope {
    #[serde(rename = "Data")]
    data: DetailData,
}

#[derive(Debug, Deserialize)]
struct DetailData {
    #[serde(rename = "Path")]
    path: Option<String>,
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "Downloads")]
    downloads: Option<u64>,
    #[serde(rename = "Stars")]
    stars: Option<u64>,
    #[serde(rename = "GmtModified")]
    last_modified: Option<String>,
    #[serde(rename = "Tags")]
    tags: Option<Vec<String>>,
    #[serde(rename = "Tasks")]
    tasks: Option<Vec<DetailTask>>,
    #[serde(rename = "ReadMeContent")]
    readme: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DetailTask {
    #[serde(rename = "Name")]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FilesEnvelope {
    #[serde(rename = "Data")]
    data: FilesData,
}

#[derive(Debug, Deserialize)]
struct FilesData {
    #[serde(rename = "Files")]
    files: Vec<RepoFile>,
}

#[derive(Debug, Deserialize)]
struct RepoFile {
    #[serde(rename = "Path")]
    path: String,
    #[serde(rename = "Size")]
    size: Option<u64>,
    #[serde(rename = "Type")]
    kind: String,
}

pub async fn search_models(query: &str) -> Result<Vec<HuggingFaceModelSummary>, String> {
    let response = client()?
        .get(format!("{MODELSCOPE_BASE}/openapi/v1/models"))
        .query(&[
            ("search", query),
            ("sort", "downloads"),
            ("page_number", "1"),
            ("page_size", "40"),
            ("filter.library", "gguf"),
        ])
        .send()
        .await
        .map_err(|error| format!("ModelScope search failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("ModelScope search failed: {error}"))?;

    let envelope = response
        .json::<SearchEnvelope>()
        .await
        .map_err(|error| format!("failed to decode ModelScope search results: {error}"))?;

    Ok(envelope
        .data
        .models
        .into_iter()
        .filter(is_likely_llama_cpp_model)
        .map(|model| {
            let tags = model.tags.unwrap_or_default();
            let tasks = model.tasks.unwrap_or_default();
            let vision_capable = vision_capable(&model.id, &tags, &tasks);
            let author = model
                .id
                .split('/')
                .next()
                .filter(|value| !value.is_empty())
                .unwrap_or("Unknown")
                .to_string();

            HuggingFaceModelSummary {
                source: "modelscope".to_string(),
                repo_id: model.id.clone(),
                author,
                downloads: model.downloads.unwrap_or(0),
                likes: model.likes.unwrap_or(0),
                last_modified: model.last_modified,
                pipeline_tag: tasks.first().cloned(),
                tags,
                vision_capable,
            }
        })
        .collect())
}

fn is_likely_llama_cpp_model(model: &SearchModel) -> bool {
    let tags = model
        .tags
        .as_deref()
        .unwrap_or_default()
        .join(" ")
        .to_ascii_lowercase();
    let tasks = model
        .tasks
        .as_deref()
        .unwrap_or_default()
        .join(" ")
        .to_ascii_lowercase();

    let unsupported_task = [
        "text-to-image",
        "image-to-image",
        "text-to-video",
        "audio-to-audio",
        "text-to-audio",
    ]
    .iter()
    .any(|task| tasks.contains(task));

    !unsupported_task && !tags.contains("comfyui")
}

pub async fn model_files(repo_id: &str) -> Result<HuggingFaceRepoDetails, String> {
    validate_repo_id(repo_id)?;

    let client = client()?;
    let detail_response = client
        .get(format!("{MODELSCOPE_BASE}/api/v1/models/{repo_id}"))
        .send()
        .await
        .map_err(|error| format!("failed to fetch ModelScope repository: {error}"))?
        .error_for_status()
        .map_err(|error| format!("failed to fetch ModelScope repository: {error}"))?;

    let detail = detail_response
        .json::<DetailEnvelope>()
        .await
        .map_err(|error| format!("failed to decode ModelScope repository: {error}"))?
        .data;

    let files_response = client
        .get(format!(
            "{MODELSCOPE_BASE}/api/v1/models/{repo_id}/repo/files"
        ))
        .query(&[("Revision", "master"), ("Recursive", "true")])
        .send()
        .await
        .map_err(|error| format!("failed to list ModelScope files: {error}"))?
        .error_for_status()
        .map_err(|error| format!("failed to list ModelScope files: {error}"))?;

    let repo_files = files_response
        .json::<FilesEnvelope>()
        .await
        .map_err(|error| format!("failed to decode ModelScope file list: {error}"))?
        .data
        .files;

    let models_dir = resolve_models_dir()?;
    let destination_dir = destination_repo_dir(&models_dir, repo_id)?;
    let mut files = repo_files
        .into_iter()
        .filter(|file| {
            file.kind.eq_ignore_ascii_case("blob")
                && file.path.to_ascii_lowercase().ends_with(".gguf")
        })
        .map(|file| {
            let downloaded = destination_path(&destination_dir, &file.path)
                .map(|path| path.is_file())
                .unwrap_or(false);
            HuggingFaceFile {
                quantization: infer_quantization(&file.path),
                is_mmproj: file.path.to_ascii_lowercase().contains("mmproj"),
                size_bytes: file.size,
                downloaded,
                filename: file.path,
            }
        })
        .collect::<Vec<_>>();

    files.sort_by(|left, right| {
        left.is_mmproj.cmp(&right.is_mmproj).then_with(|| {
            left.filename
                .to_ascii_lowercase()
                .cmp(&right.filename.to_ascii_lowercase())
        })
    });

    let repo_path = detail
        .path
        .clone()
        .unwrap_or_else(|| repo_id.split('/').next().unwrap_or("Unknown").to_string());
    let repo_name = detail
        .name
        .clone()
        .unwrap_or_else(|| repo_id.split('/').nth(1).unwrap_or(repo_id).to_string());
    let normalized_repo_id = format!("{repo_path}/{repo_name}");
    let tags = detail.tags.unwrap_or_default();
    let tasks = detail
        .tasks
        .unwrap_or_default()
        .into_iter()
        .filter_map(|task| task.name)
        .collect::<Vec<_>>();

    Ok(HuggingFaceRepoDetails {
        source: "modelscope".to_string(),
        repo_id: normalized_repo_id.clone(),
        author: repo_path,
        downloads: detail.downloads.unwrap_or(0),
        likes: detail.stars.unwrap_or(0),
        last_modified: detail.last_modified,
        pipeline_tag: tasks.first().cloned(),
        vision_capable: vision_capable(&normalized_repo_id, &tags, &tasks)
            || files.iter().any(|file| file.is_mmproj),
        tags,
        files,
        readme: detail.readme,
    })
}

pub async fn download_file(
    app: &AppHandle,
    repo_id: &str,
    filename: &str,
    tags: Vec<String>,
    pipeline_tag: Option<String>,
    mut cancellation: DownloadGuard,
) -> Result<DownloadedModel, String> {
    validate_repo_id(repo_id)?;
    validate_gguf_filename(filename)?;

    let models_dir = resolve_models_dir()?;
    let destination_dir = destination_repo_dir(&models_dir, repo_id)?;
    let destination = destination_path(&destination_dir, filename)?;
    let parent = destination
        .parent()
        .ok_or_else(|| "invalid ModelScope destination".to_string())?;
    fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("failed to create model directory: {error}"))?;

    let partial = destination.with_extension(format!(
        "{}.part",
        destination
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("gguf")
    ));

    let download_id = format!("modelscope::{repo_id}::{filename}");
    let url = resolve_download_url(repo_id, filename)?;
    let transfer = async {
        let response = client()?
            .get(url)
            .send()
            .await
            .map_err(|error| format!("failed to start ModelScope download: {error}"))?
            .error_for_status()
            .map_err(|error| format!("failed to download ModelScope model: {error}"))?;

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
                    return Err(format!("ModelScope download interrupted: {error}"));
                }
            };

            file.write_all(&chunk)
                .await
                .map_err(|error| format!("failed to write ModelScope download: {error}"))?;
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
            .map_err(|error| format!("failed to flush ModelScope download: {error}"))?;
        drop(file);

        Ok::<(u64, Option<u64>), String>((downloaded_bytes, total_bytes))
    };
    let transfer_result = Abortable::new(transfer, cancellation.take_registration()).await;
    drop(cancellation);
    let (downloaded_bytes, total_bytes) = match transfer_result {
        Ok(Ok(completed)) => completed,
        Ok(Err(error)) => {
            cleanup_partial(&partial).await?;
            return Err(error);
        }
        Err(_) => {
            cleanup_partial(&partial).await?;
            emit_progress(
                app,
                DownloadProgress {
                    download_id,
                    repo_id: repo_id.to_string(),
                    filename: filename.to_string(),
                    downloaded_bytes: 0,
                    total_bytes: None,
                    status: "stopped",
                },
            );
            return Err(STOPPED_DOWNLOAD.to_string());
        }
    };

    // Do not interrupt replacement of an existing completed GGUF.
    if fs::try_exists(&destination).await.unwrap_or(false) {
        fs::remove_file(&destination)
            .await
            .map_err(|error| format!("failed to replace existing model: {error}"))?;
    }
    fs::rename(&partial, &destination)
        .await
        .map_err(|error| format!("failed to finalize ModelScope download: {error}"))?;

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
        source: "modelscope".to_string(),
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
        .map_err(|error| format!("failed to create ModelScope HTTP client: {error}"))
}

fn resolve_download_url(repo_id: &str, filename: &str) -> Result<Url, String> {
    let mut url = Url::parse(&format!("{MODELSCOPE_BASE}/api/v1/models/{repo_id}/repo"))
        .map_err(|error| format!("failed to construct ModelScope download URL: {error}"))?;
    url.query_pairs_mut()
        .append_pair("Revision", "master")
        .append_pair("FilePath", filename);
    Ok(url)
}

fn destination_repo_dir(models_dir: &Path, repo_id: &str) -> Result<PathBuf, String> {
    let mut destination = models_dir.join("modelscope");
    for segment in repo_id.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("invalid ModelScope repository id".to_string());
        }
        destination.push(sanitize_component(segment));
    }
    Ok(destination)
}

fn destination_path(base: &Path, filename: &str) -> Result<PathBuf, String> {
    let mut destination = base.to_path_buf();
    for segment in filename.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("invalid ModelScope filename".to_string());
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
        return Err("invalid ModelScope repository id".to_string());
    }
    Ok(())
}

fn validate_gguf_filename(filename: &str) -> Result<(), String> {
    if filename.split('/').any(|segment| segment == "..")
        || !filename.to_ascii_lowercase().ends_with(".gguf")
    {
        return Err("only GGUF files can be downloaded".to_string());
    }
    Ok(())
}

fn infer_quantization(filename: &str) -> Option<String> {
    let upper = filename.to_ascii_uppercase();
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

fn vision_capable(repo_id: &str, tags: &[String], tasks: &[String]) -> bool {
    let haystack = format!("{repo_id} {} {}", tags.join(" "), tasks.join(" ")).to_ascii_lowercase();
    [
        "vision",
        "multimodal",
        "image-text-to-text",
        "image_text_to_text",
        "visual-language",
        "visual_language",
        "vlm",
        "qwen-vl",
        "qwen2-vl",
        "qwen2.5-vl",
        "qwen3-vl",
    ]
    .iter()
    .any(|marker| haystack.contains(marker))
}

fn emit_progress(app: &AppHandle, progress: DownloadProgress) {
    let _ = app.emit("model-download-progress", progress);
}
