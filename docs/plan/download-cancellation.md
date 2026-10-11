# Download Cancellation for v0.1.2

## Goal
Allow users to stop an individual active Hugging Face or ModelScope GGUF download from Model Search or Downloads. Cancellation must abort network I/O, remove only the associated temporary `.part` file, preserve existing completed GGUFs and unrelated transfers, and show an explicit Stopped status with an option to download again. Update the v0.1.2 changelog and release description.

## Planned structure
```text
studio/src-tauri/src/core/downloads/
  cancellation.rs [create: per-download abort registry, lifecycle tests]
  mod.rs [modify: exports]
  huggingface.rs [modify: abort transfer + cleanup]
  modelscope.rs [modify: abort transfer + cleanup]
studio/src-tauri/src/
  commands/downloads.rs [modify: register and stop transfers]
  lib.rs [modify: shared cancellation state and command registration]
studio/src/
  lib/tauri.ts [modify: cancel IPC binding]
  app/App.tsx [modify: cancellation state and event handling]
  features/downloads/
    types.ts [modify: stopped/stopping statuses]
    DownloadInspector.tsx [modify: Stop action and percentage]
    DownloadActivityPage.tsx [modify: per-download Stop and stopped records]
  styles/global.css [modify: Stop action styling]
CHANGELOG.md [modify: 0.1.2 user-facing entry]
ARCHITECTURE.md [modify: download lifetime]
DESIGN.md [modify: cancellation controls]
docs/plan/download-cancellation.md [create: plan]
```

## Verification
- `npm run build` for TypeScript, Go gateway build, and Vite.
- `cargo test --locked`, including cancellation isolation and concurrent/restart tests.
- `go test ./...`, format check for touched Rust, `git diff --check`.
- Confirm Stop only aborts targeted transfer, cleans partial files, and cannot produce Completed on cancellation.
- Reuse existing 0.1.2 release title, update full release description in response according to `docs/github/release_instructions.md`.
