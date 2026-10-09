mod discovery;
mod gguf;
mod settings;
mod types;

pub use discovery::discover_models;
pub(crate) use discovery::resolve_models_dir;
pub use gguf::{CapabilityHints, GgufInspection, inspect_gguf};
pub use settings::{delete_managed_model, load_model_settings, save_model_settings};
pub use types::ModelInfo;
