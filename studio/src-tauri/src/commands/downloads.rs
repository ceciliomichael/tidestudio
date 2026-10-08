use crate::core::downloads::{
    DownloadedModel, HuggingFaceModelSummary, HuggingFaceRepoDetails, download_file, model_files,
    search_models,
};
use tauri::AppHandle;

#[tauri::command]
pub async fn search_huggingface_models(
    query: String,
) -> Result<Vec<HuggingFaceModelSummary>, String> {
    search_models(query.trim()).await
}

#[tauri::command]
pub async fn huggingface_model_files(repo_id: String) -> Result<HuggingFaceRepoDetails, String> {
    model_files(repo_id.trim()).await
}

#[tauri::command]
pub async fn download_huggingface_file(
    app: AppHandle,
    repo_id: String,
    filename: String,
    tags: Vec<String>,
    pipeline_tag: Option<String>,
) -> Result<DownloadedModel, String> {
    download_file(&app, repo_id.trim(), filename.trim(), tags, pipeline_tag).await
}
