# LM-Studio-Style Model Inspector Plan

## Goal

Redesign the Models right inspector to use the information architecture shown in the provided LM Studio references, while keeping TideStudio's own product boundaries and light design system.

Use TideCode's `SegmentedField.tsx` as the style/interaction reference for the tab control, translated into TideStudio's regular CSS system.

## Inspector structure

```text
Right inspector
├── Model header
│   ├── model icon
│   └── selected model name
├── Segmented tabs
│   ├── Info
│   ├── Load
│   └── Inference
└── Active tab content
    ├── Info
    │   └── Model Information
    ├── Load
    │   ├── Context and Offload
    │   └── Advanced
    └── Inference
        └── Settings
```

The visual treatment should be dense, flat, and sectioned like LM Studio's right inspector: thin separators, compact controls, muted secondary text, and minimal card treatment.

## Behavior

### Info

Show selected mock-model metadata:

- model
- file
- format
- quantization
- architecture
- type
- publisher
- parameters
- size on disk

### Load

Edit existing supported launch configuration only:

- context size
- GPU layers
- port
- flash attention
- extra llama-server arguments

### Inference

Edit existing supported inference configuration:

- temperature

Do not invent unsupported backend settings solely to imitate LM Studio.

## Shared UI

Create a reusable `SegmentedField` based on the TideCode reference:

- full-width segmented container
- rounded outer field
- subtle inset surface
- active segment uses a raised white surface and small shadow
- inactive segments remain muted
- active segment does not change color on hover

Create a reusable `CollapsibleSection` for inspector sections:

- icon + title
- optional open/closed state
- thin top/bottom boundaries
- chevron disclosure
- no card-heavy styling

## Planned structure

```text
studio/src/
├── app/
│   └── App.tsx
├── components/
│   └── ui/
│       ├── CollapsibleSection.tsx
│       └── SegmentedField.tsx
└── features/
    └── models/
        ├── ModelInspector.tsx
        ├── ModelInfoTab.tsx
        ├── ModelLoadTab.tsx
        ├── ModelInferenceTab.tsx
        ├── ModelLibrary.tsx
        ├── mockModels.ts
        └── types.ts

studio/src/styles/global.css
ARCHITECTURE.md
DESIGN.md
docs/plan/lm-style-model-inspector.md
```

## File-by-file changes

### Create

- `studio/src/components/ui/SegmentedField.tsx`
  - Reusable segmented control based on TideCode's visual pattern.
- `studio/src/components/ui/CollapsibleSection.tsx`
  - Reusable right-inspector disclosure section.
- `studio/src/features/models/ModelInspector.tsx`
  - Own selected inspector tab and compose model header/tab content.
- `studio/src/features/models/ModelInfoTab.tsx`
  - Render mock model metadata.
- `studio/src/features/models/ModelLoadTab.tsx`
  - Render load/runtime launch configuration sections.
- `studio/src/features/models/ModelInferenceTab.tsx`
  - Render supported inference configuration.
- `docs/plan/lm-style-model-inspector.md`
  - Implementation and verification record.

### Modify

- `studio/src/app/App.tsx`
  - Replace `ModelSettings` with `ModelInspector`.
- `studio/src/features/models/types.ts`
  - Remove the now-unused `ModelFilter` type.
- `studio/src/styles/global.css`
  - Add segmented control, inspector header, metadata rows, collapsible sections, dense field rows, and tab-content styling.
- `ARCHITECTURE.md`
  - Record the Models right inspector tab structure.
- `DESIGN.md`
  - Record LM-Studio-inspired inspector hierarchy and TideCode-inspired segmented control.

### Delete

- `studio/src/features/models/ModelSettings.tsx`
  - Replaced by the tabbed Model Inspector.

## Verification

1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm the Models inspector has Info, Load, and Inference segments.
4. Confirm Info displays mock metadata.
5. Confirm Load edits the existing ServerConfig load fields.
6. Confirm Inference edits temperature.
7. Confirm no unsupported llama.cpp settings were added to ServerConfig.
8. Confirm the obsolete `ModelSettings.tsx` is removed.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- Models inspector exposes Info, Load, and Inference segments.
- Info renders mock catalog metadata.
- Load edits context size, GPU layers, port, flash attention, and extra arguments.
- Inference edits temperature.
- The Rust `ServerConfig` schema is unchanged.
- `ModelSettings.tsx` is removed.
