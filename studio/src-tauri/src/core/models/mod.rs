mod discovery;
mod gguf;
mod types;

pub use discovery::discover_models;
pub(crate) use discovery::resolve_models_dir;
pub use gguf::{CapabilityHints, GgufInspection, inspect_gguf};
pub use types::ModelInfo;
