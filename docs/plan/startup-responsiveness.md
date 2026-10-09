# Startup Responsiveness

## Intended result
- The desktop UI remains responsive while saved preferences, GGUF discovery, and the Go API gateway initialize.
- The API gateway still auto-starts with persisted Server settings. Model Search network requests occur only when its page is opened.
- Existing worker lifecycle and gateway configuration semantics remain unchanged.

## Affected structure
```text
docs/
  plan/
    startup-responsiveness.md
studio/
  src-tauri/
    src/
      commands/
        models.rs
        preferences.rs
  src/
    app/
      App.tsx
ARCHITECTURE.md
```

## File-by-file changes
- Create `docs/plan/startup-responsiveness.md`: record approach, file scope, tradeoffs, and verification.
- Modify `studio/src-tauri/src/commands/models.rs`: run GGUF discovery and settings-file I/O on Tokio blocking workers instead of as synchronous IPC commands.
- Modify `studio/src-tauri/src/commands/preferences.rs`: move startup SQLite open/query/schema operations to Tokio blocking workers.
- Modify `studio/src/app/App.tsx`: lazily prime Model Search on first visit instead of launching an unrelated remote request during Server startup.
- Modify `ARCHITECTURE.md`: document the actual startup workflow after implementation.

## Approach and tradeoffs
Keep the already-background gateway startup unchanged: it is not on the UI command thread. Offload synchronous filesystem/SQLite work so the event loop remains available during startup, and stop doing Model Search remote work until requested. IPC completion remains asynchronous, so model details may appear after the window is interactive. No additional dependencies or new settings.

## Verification
- Run Rust formatting check and Rust tests from `studio/src-tauri`.
- Run frontend TypeScript/Vite build from `studio`.
- Inspect the Git diff and ensure unrelated existing changes are preserved.
- A real Windows UI smoothness measurement is still needed after rebuilding/relaunching the desktop app.
