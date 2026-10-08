# Hugging Face Downloads Browser Plan

## Goal

Implement the Downloads workspace as a real Hugging Face GGUF browser and downloader.

## User flow

1. Open Downloads.
2. Search Hugging Face models.
3. Select a GGUF repository.
4. Inspect available GGUF files/quantizations.
5. Download a selected GGUF into TideStudio's managed models directory.
6. Show streamed download progress.
7. Inspect the completed GGUF and surface inferred capabilities.

## Workspace

```text
Downloads center
├── search field
├── search action
├── GGUF repository results
└── active/recent download progress

Downloads right inspector
├── selected repository
├── repository metadata
├── GGUF files
└── per-file Download action
```

## Capability inspection

After download, parse the GGUF metadata header without loading model tensors.

Capabilities:
- category: LLM / Embedding / Drafter
- MTP / speculative-draft capability
- reasoning/thinking
- vision/multimodal
- tool/function calling
- embedded chat template
- architecture

Detection sources:
- GGUF metadata keys and string values
- embedded `tokenizer.chat_template`
- filename/model naming conventions
- Hugging Face tags/pipeline metadata when available
- companion mmproj signals

Every inferred capability includes confidence/evidence so heuristic detections are not presented as guaranteed facts.

## Backend

Add async Tauri commands:
- `search_huggingface_models`
- `huggingface_model_files`
- `download_huggingface_file`

The downloader:
- supports public Hugging Face repositories in this pass
- downloads only GGUF files
- writes into `models/<publisher>/<repo>/...`
- streams progress through a Tauri event
- downloads to a temporary `.part` file and renames on success
- inspects the final GGUF after completion

Private/gated repo authentication is deferred.

## Files

Create:
- studio/src/features/downloads/DownloadsBrowser.tsx
- studio/src/features/downloads/DownloadInspector.tsx
- studio/src/features/downloads/types.ts
- studio/src-tauri/src/commands/downloads.rs
- studio/src-tauri/src/core/downloads/mod.rs
- studio/src-tauri/src/core/downloads/huggingface.rs
- studio/src-tauri/src/core/models/gguf.rs
- docs/plan/huggingface-downloads-browser.md

Modify:
- studio/src/app/NavigationPanel.tsx
- studio/src/app/App.tsx
- studio/src/lib/tauri.ts
- studio/src/styles/global.css
- studio/src-tauri/Cargo.toml
- studio/src-tauri/src/lib.rs
- studio/src-tauri/src/core/models/mod.rs
- ARCHITECTURE.md
- DESIGN.md
- AGENTS_LEARNING.md

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Verify Downloads navigation is enabled.
5. Verify Hugging Face commands are registered.
6. Verify downloads use `.part` then atomic rename.
7. Verify progress events are emitted.
8. Verify capability inspector parses GGUF metadata without tensor loading.
9. Verify private/gated auth is not falsely advertised.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo test` passes, including a synthetic GGUF metadata capability test.
- `cargo check` passes.
- `npm run build` passes.
- Downloads navigation is enabled.
- Hugging Face search, repository-file, and download commands are registered with Tauri.
- Live Hugging Face API repository metadata was smoke-tested successfully.
- Downloads stream through a `.part` file, emit `model-download-progress`, then finalize into the managed models directory.
- Post-download inspection parses the GGUF metadata section without loading tensors.
- Capability output covers model type, MTP/draft, reasoning, vision, and tool calling with confidence/evidence.
- Search excludes obvious non-llama.cpp GGUF uses such as ComfyUI and text/image generation pipelines.
- This pass supports public repositories only; no private/gated token UI is advertised.
