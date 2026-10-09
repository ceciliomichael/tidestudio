use crate::core::downloads::{
    DownloadedModel, HuggingFaceModelSummary, HuggingFaceRepoDetails, download_file,
    download_modelscope_file as download_modelscope_file_core, model_files,
    modelscope_model_files as modelscope_model_files_core, search_models,
    search_modelscope_models as search_modelscope_models_core,
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

#[tauri::command]
pub async fn search_modelscope_models(
    query: String,
) -> Result<Vec<HuggingFaceModelSummary>, String> {
    search_modelscope_models_core(query.trim()).await
}

#[tauri::command]
pub async fn modelscope_model_files(repo_id: String) -> Result<HuggingFaceRepoDetails, String> {
    modelscope_model_files_core(repo_id.trim()).await
}

#[tauri::command]
pub async fn download_modelscope_file(
    app: AppHandle,
    repo_id: String,
    filename: String,
    tags: Vec<String>,
    pipeline_tag: Option<String>,
) -> Result<DownloadedModel, String> {
    download_modelscope_file_core(&app, repo_id.trim(), filename.trim(), tags, pipeline_tag).await
}
