# Async Gateway Startup and Server Settings Refresh

## Intended result

- Model workers can load, become ready, stop, and update inference defaults without depending on API gateway availability.
- App startup launches/configures the API gateway in the background so gateway readiness never blocks model workflows.
- When the gateway becomes available, all ready workers are registered automatically.
- Server Settings uses a grouped, compact desktop-settings layout.
- Loaded-model and API endpoint copy controls provide copy-to-check feedback.
- New model configs default to a reasoning budget of 1024.

## Touched areas

- `studio/src-tauri/src/commands/server.rs`: decouple worker lifecycle and gateway registration; add background gateway configuration.
- `studio/src-tauri/src/core/gateway/config.rs` and `studio/src-tauri/src/lib.rs`: align default public port to 3456 and expose the startup command.
- `studio/src/app/App.tsx` and `studio/src/lib/tauri.ts`: restore settings without awaiting gateway startup.
- `studio/src/features/server/ServerDashboard.tsx`: copy-to-check interactions for endpoint and API model IDs.
- `studio/src/features/server/ServerSettingsDialog.tsx` and `studio/src/styles/global.css`: grouped settings-modal redesign.
- `studio/src/lib/config.ts`: reasoning-budget default.

## Verification

- Frontend production build and diff check.
- Rust formatting and tests.
- Go gateway tests remain green because request routing semantics do not change.
