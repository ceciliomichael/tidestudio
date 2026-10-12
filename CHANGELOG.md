# Changelog

All notable changes to TideStudio will be documented here.

## [Unreleased]

## [0.1.3] - 2026-10-12

### Changed

- Redesigned active download cards with clearer model and file information, an icon-only Stop button, and separate progress, speed, and downloaded-size details.
- Cancelled downloads now disappear from the Downloads page after cancellation completes, instead of remaining in a Stopped section. Completed downloads remain available until cleared.

### Fixed

- Settings > Back to app now returns to the page you were viewing before opening Settings rather than always going to Server.
- Stopping a download keeps its pending state visible until cancellation is confirmed, without retaining the cancelled transfer in download history.

## [0.1.2] - 2026-10-12

### Added

- Added Stop actions for active Hugging Face and ModelScope model downloads in Model Search and Downloads. Stopping a transfer interrupts the network download, cleans up its partial file, and allows the file to be downloaded again.

### Changed

- The Models page and Load Model dialog now show each GGUF filename without the `.gguf` extension, rather than the model name embedded in its metadata.
- API model IDs and the Copy Default Identifier action now use that same filename without its extension, instead of a repository-relative path.
- Deleting a model now removes its containing folder, including associated `mmproj` files, other GGUF files, and saved model settings. A GGUF stored directly in the models root is deleted individually along with its settings sidecar.

### Fixed

- Download progress percentages now use readable white text on the green progress surface in both light and dark themes.
- Model-folder deletion is blocked while any model from the folder is loaded, and conflicting filenames no longer cause an API or just-in-time request to select the wrong model.

## [0.1.1] - 2026-10-12

### Added

- Added a Beta Estimated Memory Usage card to the model load settings, showing directional GPU and total memory estimates from the selected model, context size, GPU offload, KV cache placement, and compatible draft model.
- Added GGUF metadata extraction for model block count, embedding size, attention head counts, and key/value dimensions so load controls can use model-specific information.
- Added a GPU Offload slider to the Models inspector alongside the numeric control.

### Changed

- Windows release packaging now uses faster NSIS zlib compression to reduce setup build time for the bundled CUDA runtime.
- Load Model is now available immediately during startup model discovery instead of appearing disabled until the GGUF metadata scan completes.
- TideStudio restores the last completed local-model catalog and load settings from SQLite at startup, then refreshes them from disk in the background.
- The Load Model table now keeps Size on the far-right edge, with loaded-model Stop actions positioned before it.
- Windows setup now updates an existing NSIS installation in place instead of showing the "Already Installed" maintenance/uninstall choice.
- Existing TideStudio is closed before setup replaces application files, while the previous install directory, user settings, and managed models are preserved.
- GPU Offload now uses the detected GGUF block count as the model-specific maximum when available instead of relying on a fixed generic layer limit.
- Initial GPU offload defaults now use the detected model layer count when available.
- Shared dropdown menus now render in an overlay portal and position themselves above or below the trigger based on available viewport space.
- Download-option dropdowns use the shared positioned menu with a constrained height for long GGUF lists.
- Refined model-load sliders, optional-setting checkboxes, context information, and memory-estimate presentation.
- Refined light and dark theme accent behavior across primary actions, load controls, segmented selections, and active navigation states.

### Fixed

- Prevented dropdown menus from being clipped by modal and scrolling containers.
- Prevented GPU Offload values from exceeding the model's detected layer count when that metadata is available.
- Improved selected-control text and accent contrast across light and dark themes.

## [0.1.0] - 2026-10-12

Initial public release.

### Added

- Windows x64 desktop application built with Tauri.
- Local GGUF model discovery and management.
- Model search and downloads from Hugging Face and ModelScope.
- llama.cpp-based model loading and inference.
- Per-model load and inference settings.
- GPU offload, context, batching, flash attention, and related runtime controls.
- Capability-aware settings for LLM, embedding, drafter, MTP, and decision models.
- Speculative decoding with supported MTP and compatible draft models.
- Multi-model server management.
- OpenAI-compatible, Anthropic-compatible, and TypeSafe-compatible API routing.
- Just-in-time model loading and automatic idle unloading.
- Configurable API server settings.
- Download activity tracking.
- Configurable models directory.
- Persistent workspace layout and application preferences.
- Light, dark, and system themes.
- Native Windows tray integration.
- Windows NSIS installer with the bundled llama.cpp runtime and TideStudio API gateway.

### Notes

- The initial release supports Windows x64 only.
- macOS and Linux builds are not available yet.
- TideStudio is still early, so behavior and interfaces may change between releases.
