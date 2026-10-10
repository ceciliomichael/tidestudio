# Model storage configuration

## Intended result

- Use `%USERPROFILE%\\.tidestudio\\models` as TideStudio's default managed GGUF directory in development and installed builds.
- Replace Settings > Updates with Settings > Configuration.
- Let the user choose a custom models directory with the native OS folder picker, persist it in the existing SQLite `ui_preferences` store, and apply it immediately to discovery and future downloads.
- Resetting returns to the user-profile default. Changing storage is blocked while a model worker is running so loaded-model sidecars and managed-path validation cannot become inconsistent.
- Migrate this development workspace's existing repo-local library to the new default after byte-for-byte verification.

## Affected project tree

```text
studio/package.json
studio/package-lock.json
studio/src/lib/tauri.ts
studio/src/app/App.tsx
studio/src/features/settings/SettingsSidebar.tsx
studio/src/features/settings/ConfigurationSettings.tsx
studio/src/features/settings/UpdatesSettings.tsx (remove)
studio/src/styles/global.css
studio/src-tauri/Cargo.toml
studio/src-tauri/Cargo.lock
studio/src-tauri/capabilities/default.json
studio/src-tauri/src/lib.rs
studio/src-tauri/src/commands/models.rs
studio/src-tauri/src/commands/preferences.rs
studio/src-tauri/src/core/paths.rs
ARCHITECTURE.md
DESIGN.md
AGENTS_LEARNING.md
```

## Approach and tradeoffs

- `core::paths` owns one process-wide active models directory initialized during Tauri setup, before frontend model discovery. Every existing model subsystem already resolves through this path, so switching it updates discovery, provider download destinations, sidecar validation, deletion validation, and server public IDs together.
- The custom path itself is stored as `models.directory.v1` in SQLite. The frontend does not duplicate this setting in local storage.
- A selected directory is created if needed and write-probed before activation. A path switch does not silently move a custom library; only the legacy TideStudio default is migrated as part of this approved change.
- Native folder selection uses `tauri-plugin-dialog` with directory-only selection.

## Verification

- Rust unit tests for the new `%USERPROFILE%\\.tidestudio\\models` default and Rust compile/format checks.
- Frontend TypeScript/Vite production build and `git diff --check`.
- Verify the migrated GGUF/sidecar file count, byte size, and SHA-256 hashes before deleting the old repo-local library.
- Verify the effective directory command, model discovery, and native dialog permission wiring.

## Results

- Default storage is now `%USERPROFILE%\\.tidestudio\\models`; on this machine the active default is `C:\\Users\\Admin\\.tidestudio\\models`.
- The previous `D:\\tidestudio\\models` library was copied first, then all 7 files (5,416,291,347 bytes total) were verified by SHA-256 against the originals before the legacy directory was deleted.
- Settings > Updates was removed and replaced with Configuration. The storage UI was simplified after visual review into a compact vertical card with a short helper, path field, Browse action, and conditional Use default action.
- The native folder picker is provided by `tauri-plugin-dialog`; selected custom roots are created/write-probed, persisted under `models.directory.v1`, and applied to the single Rust-owned models root. Changes are blocked while model workers are running.
- Windows canonical paths keep their `\\?\\` form internally, but UI-facing/default/persisted strings now strip the verbatim prefix (and normalize `\\?\\UNC\\...` back to a normal UNC path).
- Validation passed: Rust path tests (3/3), `cargo fmt --all --check`, `cargo check --offline --quiet`, production `npm run build`, and `git diff --check`. No old Updates references or `%LOCALAPPDATA%` model-root logic remain.
