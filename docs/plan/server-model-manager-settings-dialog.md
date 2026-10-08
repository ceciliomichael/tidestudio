# Server Model Manager and Settings Dialog Plan

## Goal

Align the Server page with the LM Studio interaction model:

- Server toolbar owns public server controls.
- Load Model opens a model-manager dialog.
- Server Settings opens a dedicated server-settings dialog.
- Right inspector shows the selected loaded model using the existing Info / Load / Inference inspector.
- Server-wide settings no longer occupy the right inspector.

## Server center

```text
Toolbar
├── Status
├── Server Settings
├── mcp.json
├── Reachable at
└── Load Model

Loaded Models
├── loaded model card
├── loaded model card
└── loaded model card

Supported Endpoints
API Logs
```

## Load Model dialog

```text
Search models...
Currently Loaded
├── model + context / quant / capability tags + Eject
└── model + context / quant / capability tags + Eject

Your Models
├── model / publisher / params / arch / format / size / Load
└── ...

Footer
└── Manually choose model load parameters
```

Mock loaded-model state is frontend-only during this design phase. Load/Eject mutates only the preview state and never invokes the llama.cpp backend.

## Server Settings dialog

Server-wide settings:
- Server Port
- Require Authentication
- Active API Keys / API Key
- Serve on Local Network
- Allow per-request MCPs
- Allow calling servers from mcp.json
- Enable CORS
- Just-in-Time Model Loading
- Auto unload unused JIT loaded models
- Max idle TTL
- Only Keep Last JIT Loaded Model

Native llama.cpp-backed settings remain:
- port
- host/LAN binding
- API key
- CORS can be wired when launch flow is restored

JIT/MCP policies are TideStudio wrapper/server-manager state and remain frontend-only for now.

## Right inspector

Use the existing reusable ModelInspector for the selected loaded preview model.

## Files

Create:
- studio/src/components/ui/Modal.tsx
- studio/src/features/server/LoadModelDialog.tsx
- studio/src/features/server/ServerSettingsDialog.tsx
- docs/plan/server-model-manager-settings-dialog.md

Modify:
- studio/src/app/App.tsx
- studio/src/features/server/ServerDashboard.tsx
- studio/src/lib/config.ts
- studio/src/styles/global.css
- ARCHITECTURE.md
- DESIGN.md
- AGENTS_LEARNING.md

Delete:
- studio/src/features/server/ServerInspector.tsx

## Verification

1. Run npm run build.
2. Run cargo check.
3. Confirm Load Model opens the model-manager dialog.
4. Confirm Server Settings opens its settings dialog.
5. Confirm mock load/eject updates loaded cards.
6. Confirm selecting a loaded mock model updates the right ModelInspector.
7. Confirm ServerInspector has no remaining references.
8. Confirm wrapper-only settings do not map to fake llama.cpp flags.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- `Load Model` opens a centered model-manager dialog with filter, Currently Loaded, Your Models, Load/Eject actions, and manual-load-parameters toggle.
- `Server Settings` opens a dedicated server-wide settings dialog.
- Mock Load/Eject mutates frontend preview state only and does not invoke backend lifecycle commands.
- Selecting a loaded preview model updates the Server right-side `ModelInspector`.
- Real managed runtimes get a minimal local model descriptor so the right panel remains model-focused.
- The old `ServerInspector` was removed and no references remain.
- JIT/MCP wrapper settings have no Rust/llama.cpp flag mappings.
