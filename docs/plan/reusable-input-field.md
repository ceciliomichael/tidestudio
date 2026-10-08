# Reusable Input Field Plan

## Goal

Use one reusable input component for every TideStudio text and number input.

Visual requirements:
- no visible border
- no outline/focus ring
- subtle filled surface only
- number inputs do not show native increment/decrement arrows

## Planned structure

```text
studio/src/
├── components/
│   └── ui/
│       └── InputField.tsx
├── features/
│   └── models/
│       ├── ModelLoadTab.tsx
│       └── ModelInferenceTab.tsx
└── styles/
    └── global.css

DESIGN.md
docs/plan/reusable-input-field.md
```

## File changes

### Create
- `studio/src/components/ui/InputField.tsx`
  - Shared text/number input with optional label, hint, and inline/stacked layout.

### Modify
- `studio/src/features/models/ModelLoadTab.tsx`
  - Replace all raw inputs with `InputField`.
- `studio/src/features/models/ModelInferenceTab.tsx`
  - Replace temperature input with `InputField`.
- `studio/src/styles/global.css`
  - Unify input styling, remove borders/focus rings, hide number spinners.
- `DESIGN.md`
  - Record the shared input rule.
- `docs/plan/reusable-input-field.md`
  - Record verification.

### Delete
- `studio/src/components/ui/TextField.tsx`
  - Superseded by `InputField`.

## Verification
1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm no raw `<input>` exists outside `InputField.tsx`.
4. Confirm no references to `TextField` remain.
5. Confirm number spinner CSS is present for WebKit and Firefox.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- `InputField.tsx` is the only file containing a raw `<input>`.
- No `TextField`, `ui-field`, or `inspector-compact-input` references remain.
- Inputs use a subtle neutral border with no focus outline or focus ring.
- Number steppers are suppressed for Chromium/WebView and Firefox.
