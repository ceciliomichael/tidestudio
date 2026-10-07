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

On Server, the center panel manages server lifecycle and the right inspector shows the selected server and logs. On Models, the center panel manages the local model library and the right inspector edits the selected model's launch configuration.

The presentation layer is currently light-mode only. Shared UI primitives carry the common visual system so feature components focus on product state and behavior rather than duplicating control markup and styling.

## Intended direction

- Add Hugging Face cache discovery to the existing model discovery boundary.
- Parse useful GGUF metadata for richer model-library information.
- Add a dedicated model download page behind the left navigation.
- Add persistent launch presets when the settings workflow requires them.
