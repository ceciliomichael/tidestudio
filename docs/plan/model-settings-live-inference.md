# Per-model settings and live inference defaults

## Result

TideStudio persists model configuration beside each managed GGUF, restores Server Settings across launches, and lets loaded models update request-time inference defaults without restarting llama.cpp.

## Structure

```text
studio/
├─ api-gateway/internal/httpapi/
│  ├─ registry.go
│  ├─ proxy.go
│  └─ *_test.go
├─ src/
│  ├─ app/App.tsx
│  ├─ features/
│  │  ├─ downloads/DownloadInspector.tsx
│  │  ├─ models/{ModelInspector,ModelLoadTab,ModelInferenceTab}.tsx
│  │  └─ server/{ServerDashboard,SupportedEndpointsPanel}.tsx
│  └─ lib/{config,tauri}.ts
└─ src-tauri/src/
   ├─ commands/{models,server}.rs
   └─ core/
      ├─ config/{inference_defaults,server_config}.rs
      ├─ gateway/{client,manager}.rs
      ├─ models/settings.rs
      └─ servers/registry.rs
```

Each model settings file is stored as:

`<model>.gguf.tidestudio.json`

with versioned `load` and `inference` sections.

## Behavior

- Model Load and Inference settings restore from the GGUF sidecar.
- Changes save back to the sidecar.
- Loading a model also saves its current settings before launch.
- Load settings remain worker-start settings and require a reload.
- Inference defaults update the API gateway for an already loaded worker.
- Per-request values override saved defaults.
- Live defaults include system prompt, sampling parameters, and reasoning/thinking controls where the target API supports them.
- llama.cpp continues to launch with `--no-webui`.
- Server Settings persist in TideStudio SQLite.
- Supported Endpoints exposes OpenAI-compatible and Anthropic-compatible families only.
- Loaded-model cards show detected quantization.
- Model Search README content renders Markdown for both Hugging Face and ModelScope.

## Files

- Modified `studio/src/app/App.tsx`: settings restore/save orchestration and live updates.
- Modified `studio/src/lib/config.ts`: sidecar schema and live-default projection.
- Modified `studio/src/lib/tauri.ts`: settings and live-update commands.
- Created `studio/src-tauri/src/core/models/settings.rs`: validated GGUF-adjacent JSON persistence.
- Created `studio/src-tauri/src/core/config/inference_defaults.rs`: shared runtime-default payload.
- Modified Rust server/gateway/registry files: retain and update defaults across worker/gateway lifecycle.
- Modified Go gateway registry/proxy: store defaults per model and merge them into inference requests.
- Modified model inspector files: communicate live versus reload-required settings.
- Modified `SupportedEndpointsPanel.tsx`: remove TideStudio segment.
- Modified `ServerDashboard.tsx`: show quantization.
- Modified `DownloadInspector.tsx` and CSS: render proper Markdown.
- Modified package manifests/lockfile: add Markdown renderer dependencies.
- Updated architecture/design/learnings.

## Verification

- `go test ./...`
- `go vet ./...`
- `cargo test`
- `cargo fmt --check`
- `npm run build`
- `git diff --check`
