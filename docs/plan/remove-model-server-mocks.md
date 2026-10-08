# Remove Models and Server Mock Data

## Goal

Remove all mock model/runtime data from Models and Server before router work begins.

## Runtime behavior

### Models
- Read only GGUFs discovered under TideStudio's managed models directory.
- Populate the catalog from real filesystem and GGUF metadata.
- Show a real empty state when no models exist.
- Never fall back to mock catalog entries.

### Server
- Loaded Models contains only real TideStudio-managed llama-server processes.
- Load Model lists only real discovered GGUFs.
- Load starts a real llama-server worker using the selected model config.
- Until the router exists, workers use sequential available ports starting at the configured server port.
- Eject/Stop stops the real managed worker.
- API Logs contains only real process output.
- Right inspector follows the selected real loaded model.
- No fake running status, PID, cards, or log output.

## Model discovery enrichment

Extend ModelInfo with real metadata:
- stable id/path
- file name / GGUF model name
- publisher inferred from managed models directory structure when available
- architecture from GGUF metadata
- category inferred from GGUF metadata/capabilities
- parameter size label when GGUF metadata provides it
- quantization inferred from filename
- file size
- modification timestamp
- reasoning support signal from GGUF inspection

Missing metadata is represented as unknown/null and rendered as Unknown rather than fabricated.

## Expected tree

```text
studio/src/
├── app/App.tsx
├── features/models/
│   ├── ModelLibrary.tsx
│   ├── types.ts
│   └── mockModels.ts              DELETE
├── features/server/
│   ├── LoadModelDialog.tsx
│   ├── ServerDashboard.tsx
│   └── ServerLogsPanel.tsx
└── lib/tauri.ts

studio/src-tauri/src/core/models/
├── discovery.rs
├── gguf.rs
└── types.rs

ARCHITECTURE.md
DESIGN.md
AGENTS_LEARNING.md
docs/plan/remove-model-server-mocks.md
```

## File changes

### Delete
- `studio/src/features/models/mockModels.ts`

### Modify
- `studio/src-tauri/src/core/models/gguf.rs`
  - Surface real GGUF parameter-size metadata when present.
- `studio/src-tauri/src/core/models/types.rs`
  - Expand `ModelInfo` with real catalog metadata.
- `studio/src-tauri/src/core/models/discovery.rs`
  - Inspect each discovered GGUF metadata header and build enriched ModelInfo.
- `studio/src/lib/tauri.ts`
  - Match expanded ModelInfo.
- `studio/src/features/models/types.ts`
  - Keep catalog fields aligned with real discovery.
- `studio/src/features/models/ModelLibrary.tsx`
  - Add real empty state.
- `studio/src/features/server/ServerDashboard.tsx`
  - Remove all preview/mock branches and load/eject real workers only.
- `studio/src/features/server/ServerLogsPanel.tsx`
  - Remove mock logs/model support.
- `studio/src/app/App.tsx`
  - Replace MOCK_MODELS state with real `listModels()`.
  - Refresh local models on startup and after downloads.
  - Initialize per-model configs for discovered models.
  - Start models from Load Model with a real available worker port.
  - Derive loaded model state from real server registry.
- `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS_LEARNING.md`
  - Remove obsolete mock-design notes and document real model/runtime sources.

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo test`.
3. Run `cargo check`.
4. Run `npm run build`.
5. Confirm no `MOCK_MODELS`, mock model names, preview-model state, or mock log strings remain under `studio/src`.
6. Confirm Models is fed by `listModels()`.
7. Confirm Server Load uses `startServer()`.
8. Confirm Server cards/logs derive only from `listServers()` / `serverLogs()`.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo test` passes.
- `cargo check` passes.
- `npm run build` passes.
- `mockModels.ts` is deleted.
- No mock model names, preview-model state, mock runtime cards, or fake log strings remain under `studio/src`.
- Models is populated from the real `listModels()` GGUF discovery command.
- GGUF discovery now enriches real models with filesystem and GGUF metadata where available.
- Download completion refreshes the real local model catalog.
- Server Load Model starts a real llama-server worker with `startServer()`.
- Until the router is implemented, additional workers use the next available port starting from the configured base port.
- Loaded Models, Eject/Stop, selection, status, and API Logs all derive from the real server registry.
