use futures_util::future::{AbortHandle, AbortRegistration};
use std::{
    collections::HashMap,
    path::Path,
    sync::{Arc, Mutex},
};

pub const STOPPED_DOWNLOAD: &str = "Model download stopped";

#[derive(Default)]
pub struct DownloadCancellation {
    active: Mutex<HashMap<String, AbortHandle>>,
}

impl DownloadCancellation {
    pub fn register(self: &Arc<Self>, id: String) -> Result<DownloadGuard, String> {
        let mut active = self.active.lock().map_err(|_| "download lock poisoned")?;
        if active.contains_key(&id) {
            return Err("this model file is already downloading".to_string());
        }

        let (handle, registration) = AbortHandle::new_pair();
        active.insert(id.clone(), handle);
        Ok(DownloadGuard {
            id,
            owner: Arc::clone(self),
            registration: Some(registration),
        })
    }

    pub fn stop(&self, id: &str) -> Result<(), String> {
        let active = self.active.lock().map_err(|_| "download lock poisoned")?;
        let handle = active
            .get(id)
            .ok_or_else(|| "this model download is no longer active".to_string())?;
        handle.abort();
        Ok(())
    }
}

pub struct DownloadGuard {
    id: String,
    owner: Arc<DownloadCancellation>,
    registration: Option<AbortRegistration>,
}

impl DownloadGuard {
    pub fn take_registration(&mut self) -> AbortRegistration {
        self.registration
            .take()
            .expect("transfer cancellation registration must be used once")
    }
}

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = self.owner.active.lock() {
            active.remove(&self.id);
        }
    }
}

pub async fn cleanup_partial(partial: &Path) -> Result<(), String> {
    match tokio::fs::remove_file(partial).await {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "failed to remove interrupted download {}: {error}",
            partial.display()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::{
        FutureExt,
        future::{Abortable, pending, ready},
    };

    #[test]
    fn stopping_one_download_does_not_abort_another() {
        let registry = Arc::new(DownloadCancellation::default());
        let mut first = registry
            .register("huggingface::one::model.gguf".into())
            .unwrap();
        let mut second = registry
            .register("modelscope::two::other.gguf".into())
            .unwrap();

        registry.stop("huggingface::one::model.gguf").unwrap();
        let interrupted = Abortable::new(pending::<()>(), first.take_registration()).now_or_never();
        let unaffected = Abortable::new(ready(()), second.take_registration()).now_or_never();

        assert!(matches!(interrupted, Some(Err(_))));
        assert!(matches!(unaffected, Some(Ok(()))));
    }

    #[test]
    fn duplicate_downloads_are_blocked_until_transfer_finishes() {
        let registry = Arc::new(DownloadCancellation::default());
        let first = registry
            .register("huggingface::one::model.gguf".into())
            .unwrap();
        assert!(
            registry
                .register("huggingface::one::model.gguf".into())
                .is_err()
        );
        registry.stop("huggingface::one::model.gguf").unwrap();
        drop(first);
        assert!(registry.stop("huggingface::one::model.gguf").is_err());
        assert!(
            registry
                .register("huggingface::one::model.gguf".into())
                .is_ok()
        );
    }

    #[test]
    fn partial_cleanup_preserves_completed_models_and_siblings() {
        let root = std::env::temp_dir().join(format!("tidestudio-stop-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let partial = root.join("model.gguf.part");
        let completed = root.join("model.gguf");
        let sibling = root.join("other.gguf.part");
        std::fs::write(&partial, b"incomplete").unwrap();
        std::fs::write(&completed, b"existing").unwrap();
        std::fs::write(&sibling, b"unrelated").unwrap();

        tauri::async_runtime::block_on(cleanup_partial(&partial)).unwrap();

        assert!(!partial.exists());
        assert_eq!(std::fs::read(&completed).unwrap(), b"existing");
        assert_eq!(std::fs::read(&sibling).unwrap(), b"unrelated");
        std::fs::remove_dir_all(root).unwrap();
    }
}
