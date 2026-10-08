# Mock Models Catalog Styling Plan

## Goal

Use mock data for the Models workspace while the central panel design is being established, so no local model downloads are required.

The mock catalog is presentation-only and must remain isolated from the real Server page/runtime model list.

## Models center panel

Remove the existing Models page heading, refresh action, empty state, and current real-model table.

Replace them with:

- a compact text dropdown in the top-left
- filter options:
  - All
  - LLMs
  - Embeddings
  - Drafters
- a dense full-width model table directly beneath the toolbar
- realistic mock rows for visual iteration

The table will expose useful visual columns such as:

- Model
- Type
- Params
- Quant
- Size
- Modified

Selecting a mock row will update the right-side model configuration inspector for styling purposes.

## Runtime isolation

- The Server page continues to use actual models returned by the Rust/Tauri model discovery API.
- Mock catalog entries are never passed to `startServer`.
- Mock model configurations are frontend-only and exist only for design iteration.

## Planned structure

```text
studio/src/
├── app/
│   └── App.tsx
├── components/
│   └── ui/
│       └── Select.tsx
├── features/
│   └── models/
│       ├── ModelLibrary.tsx
│       ├── ModelSettings.tsx
│       ├── mockModels.ts
│       └── types.ts
└── styles/
    └── global.css

DESIGN.md
docs/plan/mock-models-catalog-styling.md
```

## File-by-file changes

### Create

- `studio/src/components/ui/Select.tsx`
  - Reusable compact text dropdown.
- `studio/src/features/models/types.ts`
  - UI-only model catalog types and filter type.
- `studio/src/features/models/mockModels.ts`
  - Mock catalog entries spanning LLMs, Embeddings, and Drafters.
- `docs/plan/mock-models-catalog-styling.md`
  - This plan and verification status.

### Modify

- `studio/src/app/App.tsx`
  - Keep real runtime models for Server.
  - Add separate mock catalog selection/configuration state for Models.
- `studio/src/features/models/ModelLibrary.tsx`
  - Replace existing real-model content with filter dropdown and mock table.
- `studio/src/features/models/ModelSettings.tsx`
  - Accept UI catalog model identity while remaining configuration-only.
- `studio/src/styles/global.css`
  - Add compact dropdown, toolbar, table columns, mock model tags, and selected-row styling.
- `DESIGN.md`
  - Document that Models currently uses isolated mock catalog data during UI development.

### Delete

- None.

## Verification

1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm Models renders mock rows without local GGUF files.
4. Confirm the filter supports All, LLMs, Embeddings, and Drafters.
5. Confirm selected mock rows update the right inspector.
6. Confirm Server still uses only real discovered models.
7. Confirm mock paths/configs are never passed to `startServer`.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- Models renders mock catalog rows without local GGUF files.
- The filter includes All, LLMs, Embeddings, and Drafters.
- Selecting a mock row updates the right-side configuration inspector.
- Server continues to receive only real models from Tauri discovery.
- Mock catalog entries are never supplied to `startServer`.
