# Server Settings and Supported Endpoints Plan

## Goal

Refine the Server workspace around llama.cpp's actual HTTP server capabilities.

- Make the horizontal API Logs resize affordance visually 1px only while retaining a larger invisible hit target.
- Add right-inspector server settings for port and API-key authentication.
- Wire API key to llama.cpp's real `--api-key` flag.
- Add a Supported Endpoints panel above the bottom logs dock.
- Use the shared `SegmentedField` to switch endpoint families.

## Verified bundled/runtime support

Bundled `llama-server --help` exposes:

- `--host`
- `--port`
- `--api-key`
- `--api-key-file`
- `--cors-*`
- `--metrics`
- `--props`
- `--slots`
- `--embedding`
- `--rerank`

Current upstream llama.cpp server documents these endpoint families:

### OpenAI-compatible
- GET `/v1/models`
- POST `/v1/responses`
- POST `/v1/chat/completions`
- POST `/v1/completions`
- POST `/v1/embeddings`

### Anthropic-compatible
- POST `/v1/messages`

### llama.cpp native / monitoring
- GET `/health`
- POST `/completion`
- POST `/embeddings`
- POST `/tokenize`
- GET `/slots`
- GET `/metrics` when enabled
- GET/POST `/props` when enabled
- POST `/rerank` when reranking is enabled

## Server settings semantics

Port and API authentication are startup settings. Editing them in the right inspector updates the next-launch configuration. A running process requires restart to apply them.

## Files

Create:
- `studio/src/features/server/SupportedEndpointsPanel.tsx`

Modify:
- `studio/src/lib/config.ts`
- `studio/src/lib/tauri.ts`
- `studio/src/app/App.tsx`
- `studio/src/features/server/ServerDashboard.tsx`
- `studio/src/features/server/ServerInspector.tsx`
- `studio/src/styles/global.css`
- `studio/src-tauri/src/core/config/server_config.rs`
- `studio/src-tauri/src/core/backends/llama_cpp/process.rs`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `AGENTS_LEARNING.md`
- `docs/plan/server-settings-supported-endpoints.md`

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Confirm API key maps to `--api-key` only when enabled and non-empty.
5. Confirm port/API-key controls render in the Server right inspector.
6. Confirm Supported Endpoints uses `SegmentedField`.
7. Confirm the log resize target has only one 1px visible divider.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo check` passes.
- `npm run build` passes.
- API key is accepted by Rust `ServerConfig` and maps to llama.cpp `--api-key` only when non-empty.
- Server right inspector exposes port, local-network binding, API-key enablement, and API-key input as next-launch/restart settings.
- Supported Endpoints uses the shared `SegmentedField` with OpenAI-compatible, Anthropic-compatible, and llama.cpp groups.
- The horizontal resize hit target is transparent; the only visible divider is the API Logs panel's 1px top border.
