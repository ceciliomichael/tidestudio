# Model Filenames and Folder Deletion

## Intended behavior
- Models and Server > Load Model show the exact GGUF filename stem (without the `.gguf` extension) in the Model column, independent of metadata-derived display names.
- Load Model filename-stem search and name sorting use that same label. Full filenames remain available in tooltips.
- The same filename stem is the worker/API model ID and the copied default identifier, replacing the old repository-relative ID. JIT omits ambiguous duplicate stems, and explicit loading rejects conflicting active IDs rather than selecting the wrong GGUF.
- Deleting a model stored in a subfolder removes its entire containing directory, including mmproj, GGUF siblings, and sidecars.
- Deleting a GGUF directly under the configured models root removes only that GGUF and its adjacent settings sidecar. The models root is never removed.
- Require confirmation explaining the destructive scope. Reject deletion when any active worker uses a GGUF inside the folder. Reject paths outside managed storage or paths that do not identify a managed non-projector GGUF.
- On success, refresh discovered models and clear per-model configurations for every deleted file. Do not change repository identity, metadata discovery, or unrelated screens.

## Planned structure and files
```text
studio/
├── src/app/App.tsx                        (modify: delete-state cleanup)
├── src/features/models/
│   ├── types.ts                          (modify: path display and matching helpers)
│   └── ModelLibrary.tsx                   (modify: model column and delete confirmation)
├── src/features/server/LoadModelDialog.tsx (modify: filename labels, search, name sort)
├── src/features/downloads/DownloadInspector.tsx (modify: downloading percentage styling hook)
├── src/styles/global.css                  (modify: active-download percentage contrast)
└── src-tauri/src/
    ├── commands/models.rs                (modify: active worker protection)
    ├── commands/server.rs                (modify: reject active API ID collisions)
    └── core/models/
        ├── launch.rs                     (modify: filename-based API IDs, collision handling, tests)
        └── settings.rs                   (modify: guarded recursive removal and tests)
ARCHITECTURE.md                            (modify: deletion behavior)
DESIGN.md                                  (modify: filename presentation)
docs/plan/models-filename-folder-deletion.md (create: this plan)
```

## Verification
1. TypeScript type-check and Vite/frontend build.
2. Rust focused deletion tests and compilation.
3. Confirm validation rejects unmanaged paths, a loaded GGUF inside the target folder, and root deletion; allows removing a dedicated repository directory and leaves sibling repositories untouched.
4. Verify filenames without extensions match API IDs, and duplicate stems cannot resolve to the wrong JIT model.
5. Confirm progress percentages have white text in light/dark themes without changing disabled Completed styling.
