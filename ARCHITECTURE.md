# Architecture

## Current implementation

TideStudio is a Rust + Tauri desktop application under `studio/`.

The application is split into three primary boundaries:

1. **Rust Core** in `studio/src-tauri/src/core/`
   - `backends/`: inference backend abstraction and concrete backend implementations.
   - `models/`: local GGUF discovery and model metadata.
   - `config/`: typed server launch configuration.
   - `servers/`: active server registry, status, and captured logs.
2. **Tauri IPC** in `studio/src-tauri/src/commands/`
   - Thin commands expose core behavior to the frontend.
3. **Frontend** in `studio/src/`
   - React + TypeScript features for navigation, model selection, server settings, status, and logs.
   - Shared presentation primitives in `components/ui/` provide reusable buttons, fields, switches, status treatments, and section headers.
   - Server and Models are separate application destinations. Server owns runtime lifecycle and logs; Models owns model selection and per-model launch configuration.

Runtime binaries are separate from backend abstractions. llama.cpp binaries live at `studio/runtime/llama.cpp/`, while `LlamaCppBackend` defines how TideStudio controls them.

Workspace-managed GGUF files are stored under `models/`.

## Backend abstraction

`InferenceBackend` is the boundary between the server registry and a concrete inference engine.

```text
ServerRegistry
    |
InferenceBackend
    |
LlamaCppBackend
    |
runtime/llama.cpp/llama-server.exe
```

`InferenceBackend` starts a backend-neutral `ManagedInference` instance. The managed instance exposes process identity, running state, stop behavior, and logs without leaking llama.cpp-specific process types into the registry.

The current implementation only provides `LlamaCppBackend`. Additional backends should only be added when they become real product requirements.

## Data flow

```text
React UI
  -> Tauri command
    -> ServerRegistry
      -> InferenceBackend
        -> LlamaCppBackend
          -> llama-server child process
    <- typed status/log data
  <- Tauri IPC
```

## Runtime lifecycle

Starting a server:

1. The registry checks whether the requested port is already managed.
2. The registry delegates startup to its configured `InferenceBackend`.
3. `LlamaCppBackend` resolves `studio/runtime/llama.cpp/llama-server.exe`.
4. The backend validates the model path and translates typed configuration into command-line arguments.
5. The backend starts the process and returns a backend-neutral managed instance.
6. The registry stores the instance by port.

Stopping, status, and log retrieval operate through `ManagedInference` rather than llama.cpp-specific types.

The registry also exposes a list operation so the frontend can render every TideStudio-managed server. Each server status includes its backend, model path, port, PID, and running state.

## Frontend layout

The desktop workspace is a resizable three-panel layout:

- left: product navigation
- center: active page content
- right: contextual inspector for the active page

The initial proportion is approximately 20/60/20. The left and right separators are draggable and enforce minimum usable widths.

On Server, the center panel is a vertical runtime workspace. The top region contains the server toolbar, real loaded-model cards, and supported endpoints. The bottom region is a collapsible, vertically resizable API Logs dock driven by the selected running model. Loaded models are real TideStudio-managed llama-server processes only.

The Server right inspector reuses the Models `ModelInspector` for the selected loaded model. Server-wide configuration is intentionally separated from model configuration and is opened from the Server Settings toolbar action.

The Server workspace also surfaces llama.cpp HTTP capabilities directly. A Supported Endpoints panel groups OpenAI-compatible, Anthropic-compatible, and llama.cpp-native routes with the shared segmented control. Server launch configuration owns network binding, port, and API-key authentication; API keys map directly to llama.cpp's `--api-key` option. JIT loading and MCP policies shown in Server Settings are TideStudio server-manager concerns and are not mapped to fake llama.cpp flags.

The Models inspector is split into three presentation tabs: Info, Load, and Inference. Info renders catalog metadata; Load edits supported launch/runtime fields; Inference edits supported generation fields. The tab structure is frontend-only and does not change the backend configuration schema.

Models and Server use the same real local model source. Rust recursively discovers GGUF files under the managed models directory and enriches them from GGUF header metadata. Missing metadata is surfaced as unknown rather than replaced with demo values.

Downloads is a real Hugging Face-backed workspace. The React center panel searches public GGUF repositories while the right inspector loads the selected repository's GGUF files. Rust owns all Hugging Face HTTP access and streamed downloads so browser/CORS restrictions do not leak into the frontend. Downloads are written under the managed `models/<publisher>/<repo>/` tree using a temporary `.part` file before final rename.

After a GGUF download, TideStudio parses only the GGUF header and metadata section, not model tensors. The inspector derives architecture, embedded chat template, model type, MTP/drafter, reasoning, vision, and tool-calling signals from GGUF metadata plus Hugging Face repository metadata and naming conventions. Capability results are evidence-based with confidence levels because reasoning/tool support is not represented by one universal GGUF flag.

The planned public API layer is a separate Go gateway in front of llama.cpp workers. It will eventually own one public API port, OpenAI/Anthropic compatibility, authentication, routing, JIT loading, and worker lifecycle policy while Rust/Tauri remains responsible for desktop integration and local process management.

Model settings and server settings are separate frontend concerns. Per-model configuration contains context/offload, flash attention, generation settings, speculative decoding/MTP settings, and extra llama.cpp arguments. Server configuration owns host/port and lifecycle. The frontend combines both into the Tauri `ServerConfig` payload only when a server is started.

Small persistent UI preferences are stored in SQLite under the TideStudio app-data directory. A generic `ui_preferences` key/value table is accessed through Tauri commands so React components do not own database logic directly.

The llama.cpp backend maps speculative modes to the bundled runtime's supported flags: MTP uses `--spec-type draft-mtp`; external draft models use `--spec-type draft-simple` plus `--spec-draft-model`. Draft token limits, minimum probability, and draft GPU layers use their corresponding `--spec-draft-*` flags.

Model inference defaults distinguish request-time and launch-time settings. System prompt is request-time state and is intentionally omitted from `ServerConfig` because the bundled `llama-server` has no global system-prompt launch flag. Prompt template, reasoning controls, and sampling defaults are launch-time settings because the bundled runtime exposes corresponding CLI flags.

The presentation layer is currently light-mode only. Shared UI primitives carry the common visual system so feature components focus on product state and behavior rather than duplicating control markup and styling.

## Intended direction

- Add Hugging Face cache discovery to the existing model discovery boundary.
- Parse useful GGUF metadata for richer model-library information.
- Add a dedicated model download page behind the left navigation.
- Add persistent launch presets when the settings workflow requires them.
