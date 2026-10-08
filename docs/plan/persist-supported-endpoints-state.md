# Persist Supported Endpoints State Plan

## Goal

Make Supported Endpoints collapsed by default and persist its collapsed/open state in SQLite across app restarts.

## Storage

Add a small generic SQLite-backed UI preference store:
- database: TideStudio app-data/tidestudio.sqlite3
- table: ui_preferences
- key: TEXT PRIMARY KEY
- value: TEXT NOT NULL

Preference key:
- server.supported_endpoints.collapsed

## Behavior

- First run / no stored value: collapsed.
- On mount: read persisted value.
- On toggle: update UI immediately and persist the new value.
- Persistence is generic so future UI preferences can reuse the same commands.

## Files

Create:
- studio/src-tauri/src/commands/preferences.rs
- docs/plan/persist-supported-endpoints-state.md

Modify:
- studio/src-tauri/Cargo.toml
- studio/src-tauri/src/commands/mod.rs
- studio/src-tauri/src/lib.rs
- studio/src/lib/tauri.ts
- studio/src/features/server/SupportedEndpointsPanel.tsx
- ARCHITECTURE.md
- DESIGN.md
- AGENTS_LEARNING.md

## Verification

1. Run cargo fmt --all.
2. Run cargo check.
3. Run npm run build.
4. Confirm panel initializes collapsed before preference load.
5. Confirm SQLite commands are registered.
6. Confirm toggle persists server.supported_endpoints.collapsed.

## Status

Implemented and verified.

- Added SQLite persistence via rusqlite with bundled SQLite.
- Database lives in TideStudio's app-data directory as tidestudio.sqlite3.
- Generic ui_preferences table stores string key/value pairs.
- Supported Endpoints defaults to collapsed when no preference exists.
- Panel loads server.supported_endpoints.collapsed on mount.
- Every toggle persists the new state.
- cargo fmt --all passes.
- cargo check passes.
- npm run build passes.
