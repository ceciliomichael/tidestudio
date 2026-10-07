# TideStudio v1 Architecture Plan

## Status

Scaffold implemented and verified.

- React/Vite production build passes.
- Rust `cargo check` passes after `cargo fmt`.
- Existing llama.cpp runtime moved to `studio/runtime/llama.cpp/`.
- Root `llama.cpp/` directory removed.
- `studio/runtime/llama.cpp/llama-server.exe` verified present.
- Tauri application icon set generated from `studio/src-tauri/icons/source.svg`.

## Backend abstraction and three-panel workspace

This revision is approved for implementation.

### Revision status

Implemented and verified.

- `InferenceBackend` and backend-neutral `ManagedInference` are in place.
- `LlamaCppBackend` is the only concrete backend.
- `ServerRegistry` has no direct llama.cpp dependency.
- The old `core/llama/` module has been removed.
- The desktop workspace now starts around 20/60/20 with left navigation, center content, and right configuration.
- Both panel separators are draggable and enforce usable width constraints.
- `cargo check` passes.
- `npm run build` passes.
- `studio/runtime/llama.cpp/llama-server.exe` remains present.

### Intended result

- Introduce an explicit `InferenceBackend` boundary so the server registry does not depend directly on llama.cpp.
- Make llama.cpp the first concrete backend through `LlamaCppBackend`.
- Keep runtime binaries under `studio/runtime/llama.cpp/`; runtime storage and backend abstraction remain separate responsibilities.
- Redesign the application workspace around an initial 20/60/20 composition:
  - left: product navigation
  - center: active page content, initially the model library and server logs
  - right: selected-model and llama-server configuration
- Make the left and right panels resizable with draggable separators.
- Preserve useful minimum widths so resizing cannot make a panel unusable.
- Keep Lucide icons and the restrained visual system defined in `DESIGN.md`.

### Planned structure after this revision

```text
studio/
├── runtime/
│   └── llama.cpp/
│       └── llama-server.exe
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── NavigationPanel.tsx
│   │   ├── ResizableWorkspace.tsx
│   │   └── useResizablePanels.ts
│   ├── features/
│   │   ├── logs/
│   │   │   └── ServerLogs.tsx
│   │   ├── models/
│   │   │   └── ModelLibrary.tsx
│   │   └── server/
│   │       └── ServerSettings.tsx
│   ├── lib/
│   │   └── tauri.ts
│   └── styles/
│       └── global.css
└── src-tauri/
    └── src/
        ├── lib.rs
        ├── commands/
        │   └── server.rs
        └── core/
            ├── mod.rs
            ├── backends/
            │   ├── mod.rs
            │   ├── inference_backend.rs
            │   └── llama_cpp/
            │       ├── mod.rs
            │       ├── backend.rs
            │       ├── manager.rs
            │       └── process.rs
            ├── config/
            │   └── server_config.rs
            ├── models/
            │   ├── discovery.rs
            │   └── types.rs
            └── servers/
                └── registry.rs
```

### File-by-file revision

#### Create

- `studio/src/app/NavigationPanel.tsx`: persistent left navigation with Models active and future Download/Settings destinations represented without implementing those pages.
- `studio/src/app/ResizableWorkspace.tsx`: three-panel layout and draggable separator rendering.
- `studio/src/app/useResizablePanels.ts`: pointer-driven panel sizing, initial 20/60/20 proportions, and width constraints.
- `studio/src-tauri/src/core/backends/mod.rs`: backend module exports.
- `studio/src-tauri/src/core/backends/inference_backend.rs`: `InferenceBackend` and backend-neutral managed-instance interfaces.
- `studio/src-tauri/src/core/backends/llama_cpp/mod.rs`: llama.cpp backend exports.
- `studio/src-tauri/src/core/backends/llama_cpp/backend.rs`: `LlamaCppBackend` implementation.
- `studio/src-tauri/src/core/backends/llama_cpp/manager.rs`: llama-server executable resolution.
- `studio/src-tauri/src/core/backends/llama_cpp/process.rs`: llama-server child process and log capture implementing the backend-neutral instance interface.

#### Modify

- `studio/src/app/App.tsx`: compose navigation, center content, and right configuration through the resizable workspace.
- `studio/src/features/models/ModelLibrary.tsx`: adapt the library to center-panel presentation instead of being the application sidebar.
- `studio/src/features/server/ServerSettings.tsx`: adapt configuration controls to a narrow right inspector panel.
- `studio/src/features/logs/ServerLogs.tsx`: fit logs into the center working surface.
- `studio/src/lib/tauri.ts`: include backend identity in server status.
- `studio/src/styles/global.css`: implement the restrained 20/60/20 workspace, split handles, navigation, main surface, and right inspector.
- `studio/src-tauri/tauri.conf.json`: raise the minimum desktop window width so all three panels remain usable at their constrained sizes.
- `studio/src-tauri/src/core/mod.rs`: replace the direct llama module with `backends`.
- `studio/src-tauri/src/core/servers/registry.rs`: own an `InferenceBackend` trait object and manage backend-neutral running instances.
- `studio/src-tauri/src/commands/server.rs`: start through the registry/backend boundary instead of resolving llama-server directly.
- `studio/src-tauri/src/lib.rs`: initialize the registry with `LlamaCppBackend`.
- `ARCHITECTURE.md`: record the backend abstraction and dependency direction.
- `DESIGN.md`: record the resizable three-panel desktop layout.

#### Delete

- `studio/src-tauri/src/core/llama/mod.rs`
- `studio/src-tauri/src/core/llama/manager.rs`
- `studio/src-tauri/src/core/llama/process.rs`

The old direct llama module is replaced rather than kept as a compatibility layer.

### Verification for this revision

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Confirm the backend registry contains no direct dependency on llama.cpp process types.
5. Confirm the old `core/llama/` module is removed.
6. Confirm `studio/runtime/llama.cpp/llama-server.exe` remains present.
7. Confirm the frontend exposes draggable left and right separators with initial 20/60/20 sizing.

## Goal

Build TideStudio as a focused desktop manager for `llama-server`, using Rust + Tauri for the native/backend layer and React + TypeScript for the UI.

The project structure follows the original architecture:

- Rust Core
  - model discovery
  - llama.cpp manager
  - configuration
  - server registry
- Tauri IPC
- Frontend
  - model library
  - server configuration
  - live logs/status

The existing llama.cpp binaries are moved out of the repository root and into the app runtime area.

## Planned structure

```text
D:\tidestudio
├── AGENTS.md
├── AGENTS_LEARNING.md
├── ARCHITECTURE.md
├── DESIGN.md
├── docs/
│   └── plan/
│       └── tidestudio-v1-scaffold.md
├── models/
└── studio/
    ├── index.html
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── runtime/
    │   └── llama.cpp/
    │       ├── llama-server.exe
    │       ├── llama-server-impl.dll
    │       ├── llama.dll
    │       ├── ggml*.dll
    │       └── ...
    ├── src/
    │   ├── main.tsx
    │   ├── app/
    │   │   └── App.tsx
    │   ├── features/
    │   │   ├── models/
    │   │   │   └── ModelLibrary.tsx
    │   │   ├── server/
    │   │   │   └── ServerSettings.tsx
    │   │   └── logs/
    │   │       └── ServerLogs.tsx
    │   ├── lib/
    │   │   └── tauri.ts
    │   └── styles/
    │       └── global.css
    └── src-tauri/
        ├── build.rs
        ├── Cargo.toml
        ├── tauri.conf.json
        ├── icons/
        │   ├── source.svg
        │   └── icon.ico
        ├── capabilities/
        │   └── default.json
        └── src/
            ├── main.rs
            ├── lib.rs
            ├── commands/
            │   ├── mod.rs
            │   ├── models.rs
            │   └── server.rs
            └── core/
                ├── mod.rs
                ├── models/
                │   ├── mod.rs
                │   ├── discovery.rs
                │   └── types.rs
                ├── llama/
                │   ├── mod.rs
                │   ├── manager.rs
                │   └── process.rs
                ├── config/
                │   ├── mod.rs
                │   └── server_config.rs
                └── servers/
                    ├── mod.rs
                    └── registry.rs
```

## Responsibilities

### Rust Core

`core/models`
- Discover local GGUF files.
- Provide model metadata to the UI.
- Later add Hugging Face cache discovery without coupling it to Tauri.

`core/llama`
- Resolve the bundled `llama-server` executable.
- Spawn, stop, and monitor the process.
- Capture stdout/stderr for live logs.

`core/config`
- Define typed `llama-server` settings.
- Keep common settings first-class.
- Keep `extra_args` as an escape hatch for new llama.cpp flags.

`core/servers`
- Track active server processes and status.
- Own the in-memory runtime registry.

### Tauri IPC

`commands/models.rs`
- Expose model discovery to the frontend.

`commands/server.rs`
- Expose start, stop, status, and log operations.

### Frontend

`features/models`
- Model library and selection.

`features/server`
- Server launch configuration.

`features/logs`
- Live llama-server output and status.

### Visual system

- Follow the calm, deliberate design direction documented in `DESIGN.md`.
- Prefer flat solid surfaces, fine borders, open layouts, restrained depth, and clear hierarchy.
- Avoid gradients, glass effects, decorative cards, heavy shadows, and visual noise.
- Use `lucide-react` for interface icons. Do not use emoji as UI icons.
- Pair icons with text when the action or meaning is not immediately obvious.

## Initial server configuration

The first typed configuration includes:

- model path
- host
- port
- context size
- GPU layers
- temperature
- flash attention
- optional draft/MTP-related arguments through `extra_args`

Do not attempt to model every llama.cpp flag in v1.

## File changes

### Create
- `studio/.gitignore`
- `studio/package.json`
- `studio/package-lock.json` (generated by npm install)
- `studio/index.html`
- `studio/tsconfig.json`
- `studio/vite.config.ts`
- `studio/src/main.tsx`
- `studio/src/app/App.tsx`
- `studio/src/features/models/ModelLibrary.tsx`
- `studio/src/features/server/ServerSettings.tsx`
- `studio/src/features/logs/ServerLogs.tsx`
- `studio/src/lib/tauri.ts`
- `studio/src/styles/global.css`
- `studio/src-tauri/build.rs`
- `studio/src-tauri/Cargo.toml`
- `studio/src-tauri/tauri.conf.json`
- `studio/src-tauri/icons/source.svg`
- `studio/src-tauri/icons/icon.ico` and Tauri-generated platform icon assets
- `studio/src-tauri/capabilities/default.json`
- `studio/src-tauri/src/main.rs`
- `studio/src-tauri/src/lib.rs`
- `studio/src-tauri/src/commands/mod.rs`
- `studio/src-tauri/src/commands/models.rs`
- `studio/src-tauri/src/commands/server.rs`
- `studio/src-tauri/src/core/mod.rs`
- `studio/src-tauri/src/core/models/mod.rs`
- `studio/src-tauri/src/core/models/discovery.rs`
- `studio/src-tauri/src/core/models/types.rs`
- `studio/src-tauri/src/core/llama/mod.rs`
- `studio/src-tauri/src/core/llama/manager.rs`
- `studio/src-tauri/src/core/llama/process.rs`
- `studio/src-tauri/src/core/config/mod.rs`
- `studio/src-tauri/src/core/config/server_config.rs`
- `studio/src-tauri/src/core/servers/mod.rs`
- `studio/src-tauri/src/core/servers/registry.rs`

### Modify
- `ARCHITECTURE.md`
- `DESIGN.md`

### Move
- `llama.cpp/*` -> `studio/runtime/llama.cpp/*`
- remove the now-empty root `llama.cpp/` directory

## Verification

- Install frontend dependencies.
- Run the frontend production build.
- Run `cargo check` for the Rust backend.
- Confirm `studio/runtime/llama.cpp/llama-server.exe` exists.
- Confirm the root `llama.cpp/` directory no longer exists.
- Confirm the final tree matches this plan.
