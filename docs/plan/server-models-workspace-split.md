# Server and Models Workspace Split

## Goal

Separate TideStudio's two current product responsibilities into dedicated destinations:

- **Server**: lifecycle and runtime management for all TideStudio-managed inference servers.
- **Models**: local model management and per-model launch configuration.

The existing resizable 20/60/20 shell remains unchanged.

## Intended UX

### Sidebar

Order:

1. Server
2. Models
3. Downloads
4. Presets
5. Settings

Server and Models are interactive. Future destinations remain disabled.

### Server page

The center panel owns server operations:

- list every server currently managed by TideStudio
- show backend, model, port, PID, and running state
- start a server for a configured model
- stop a selected/running server
- select a managed server

The right inspector becomes server context:

- selected server identity and status
- selected server logs

Server lifecycle controls do not appear on the Models page.

### Models page

The center panel contains only the local model library.

Selecting a model opens its configuration in the right inspector:

- port
- context size
- GPU layers
- temperature
- flash attention
- extra llama-server arguments

Configuration is held per model in frontend state for the current app session. No persistence layer is added in this change.

## Planned structure

```text
studio/src/
├── app/
│   ├── App.tsx
│   └── NavigationPanel.tsx
├── features/
│   ├── models/
│   │   ├── ModelLibrary.tsx
│   │   └── ModelSettings.tsx
│   └── server/
│       ├── ServerDashboard.tsx
│       └── ServerInspector.tsx
└── lib/
    └── tauri.ts

studio/src-tauri/src/
├── commands/
│   └── server.rs
└── core/
    └── servers/
        └── registry.rs

ARCHITECTURE.md
DESIGN.md
docs/plan/server-models-workspace-split.md
```

## File-by-file changes

### Create

- `studio/src/features/models/ModelSettings.tsx`
  - Per-model launch configuration editor only. No start/stop controls.
- `studio/src/features/server/ServerDashboard.tsx`
  - Server page center content for launching configured models and listing managed servers.
- `studio/src/features/server/ServerInspector.tsx`
  - Selected managed-server metadata, stop action, and runtime logs.
- `docs/plan/server-models-workspace-split.md`
  - Implementation plan and verification record.

### Modify

- `studio/src/app/App.tsx`
  - Add active-page navigation state.
  - Own per-model configuration state.
  - Load and poll the managed-server list.
  - Route center/right content between Server and Models.
- `studio/src/app/NavigationPanel.tsx`
  - Add Server above Models and make both destinations interactive.
- `studio/src/features/models/ModelLibrary.tsx`
  - Update copy so Models is strictly library/management focused.
- `studio/src/lib/tauri.ts`
  - Add model path to server status and expose `listServers()`.
- `studio/src-tauri/src/core/servers/registry.rs`
  - Track model path for each managed server and expose a backend-neutral list operation.
- `studio/src-tauri/src/commands/server.rs`
  - Add `list_servers` command.
- `studio/src-tauri/src/lib.rs`
  - Register `list_servers`.
- `studio/src/styles/global.css`
  - Add server dashboard/list styling while preserving the current light design system.
- `ARCHITECTURE.md`
  - Document separate Server and Models frontend responsibilities and managed-server listing.
- `DESIGN.md`
  - Document navigation order and page-specific center/right panel roles.

### Delete

- `studio/src/features/server/ServerSettings.tsx`
  - Replaced by Models-specific `ModelSettings.tsx`.
- `studio/src/features/logs/ServerLogs.tsx`
  - Runtime logs move into the Server inspector.

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Confirm Server appears above Models and both are navigable.
5. Confirm Models center contains no server logs or start/stop actions.
6. Confirm model configuration remains in the right inspector on Models.
7. Confirm Server center can launch configured models and list all registered servers.
8. Confirm Server inspector can stop the selected server and show its logs.
9. Confirm `list_servers` returns every registered server rather than a single tracked frontend status.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo check` passes.
- `npm run build` passes.
- Server is above Models in navigation and both destinations are interactive.
- Models contains only model library management in the center and per-model launch configuration in the right inspector.
- Server contains launch controls and the complete managed-server registry in the center.
- The Server inspector shows selected server metadata, logs, and stop control.
- `list_servers` is registered through Tauri IPC and backed by the full Rust server registry.
- The obsolete mixed `ServerSettings` and `ServerLogs` components are removed.
