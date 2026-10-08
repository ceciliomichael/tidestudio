# Model vs Server Configuration Split

## Goal

Keep the Models inspector strictly model/inference focused and move server/network settings such as port to the Server page.

Add real speculative decoding controls based on the flags supported by the bundled `llama-server`.

## Verified llama.cpp support

The bundled runtime exposes:

- `--spec-type` including `draft-mtp` and `draft-simple`
- `--spec-draft-model`
- `--spec-draft-ngl`
- `--spec-draft-n-max`
- `--spec-draft-n-min`
- `--spec-draft-p-min`

## Configuration ownership

### Model configuration

Per-model settings:

- context size
- GPU layers / offload
- temperature
- flash attention
- speculative mode
  - none
  - MTP
  - draft model
- draft model path
- draft GPU layers
- max draft tokens
- min draft tokens
- minimum draft probability
- extra llama.cpp arguments

### Server configuration

Server-only settings:

- host, currently fixed to localhost
- port
- lifecycle and runtime status

The frontend combines model configuration with server settings only when launching a server.

## Planned structure

```text
studio/src/
├── app/
│   └── App.tsx
├── features/
│   ├── models/
│   │   ├── ModelLoadTab.tsx
│   │   ├── ModelInferenceTab.tsx
│   │   ├── ModelInspector.tsx
│   │   └── types.ts
│   └── server/
│       └── ServerDashboard.tsx
└── lib/
    ├── config.ts
    └── tauri.ts

studio/src-tauri/src/core/
├── config/
│   └── server_config.rs
└── backends/llama_cpp/
    └── process.rs

ARCHITECTURE.md
DESIGN.md
docs/plan/model-server-config-split.md
```

## File changes

### Create

- `studio/src/lib/config.ts`
  - Shared frontend `ModelConfig` and speculative mode types used by Models and Server.
- `docs/plan/model-server-config-split.md`

### Modify

- `studio/src/lib/tauri.ts`
  - Extend launch payload with speculative fields while keeping server-only host/port in `ServerConfig`.
- `studio/src/app/App.tsx`
  - Store model settings separately from server ports.
  - Build `ServerConfig` only at launch time.
- `studio/src/features/models/ModelLoadTab.tsx`
  - Remove port.
  - Add speculative decoding controls and extra args.
- `studio/src/features/models/ModelInferenceTab.tsx`
  - Use `ModelConfig` rather than `ServerConfig`.
- `studio/src/features/models/ModelInspector.tsx`
  - Accept and edit `ModelConfig`.
- `studio/src/features/server/ServerDashboard.tsx`
  - Own editable launch port per model.
- `studio/src-tauri/src/core/config/server_config.rs`
  - Add speculative decoding fields.
- `studio/src-tauri/src/core/backends/llama_cpp/process.rs`
  - Translate speculative model settings to verified llama.cpp flags.
- `ARCHITECTURE.md`
  - Document model/server config ownership.
- `DESIGN.md`
  - Document that Models must not show server/network settings.

### Delete

- None.

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Confirm Models contains no port/host controls.
5. Confirm Server owns port.
6. Confirm MTP maps to `--spec-type draft-mtp`.
7. Confirm external draft mode maps to `--spec-type draft-simple` and `--spec-draft-model`.
8. Confirm speculative token/probability/GPU-layer fields map to the verified llama.cpp flags.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo check` passes.
- `npm run build` passes.
- Models contains no port or host controls.
- Server owns the editable port used when launching a model.
- MTP maps to `--spec-type draft-mtp`.
- External draft mode maps to `--spec-type draft-simple` and `--spec-draft-model`.
- Draft GPU layers map to `--spec-draft-ngl`.
- Draft max/min tokens map to `--spec-draft-n-max` and `--spec-draft-n-min`.
- Draft minimum probability maps to `--spec-draft-p-min`.
