# TideStudio Light UI Design System Plan

## Goal

Refresh TideStudio's frontend to follow the visual system and spacing patterns of the local TideCode reference at `C:\Users\Admin\Desktop\tidecode`, while keeping TideStudio's own product structure and behavior.

This revision is approved for implementation by the user's current request.

## Visual direction taken from TideCode

- Light mode only. No dark-theme selector, dark variables, or theme switching.
- Google Sans Flex as the primary interface font.
- Warm near-white application background.
- Soft gray navigation and inspector surfaces.
- White primary workspace surface.
- Fine neutral borders and very restrained shadow.
- Green brand/action accent based on TideCode's light palette.
- Rounded-xl controls and selected navigation states.
- Sidebar spacing around 16 to 20 px, with compact 40 to 44 px interaction rows.
- Muted secondary text and technical monospace only where useful.
- Subtle invisible/wide resize hit areas rather than visually heavy splitter bars.

## Product changes

- Keep `Models` as the active sidebar destination.
- Keep the current model library and server logs in the Models center workspace.
- Keep Downloads, Presets, and Settings as quiet future destinations.
- Remove the sidebar `Backend / llama.cpp` footer entirely.
- Preserve the existing resizable three-panel workspace.
- Make the resize hit zones invisible and place them directly over panel edges, with cursor change as the only hover feedback.
- Keep the center workspace surface flat without an edge shadow.
- Restyle the right panel as a clean contextual inspector.
- Keep server status in the top application header.
- Do not add dark mode until explicitly requested later.

## Shared UI primitives

Create a focused reusable component layer instead of repeating raw buttons, inputs, switches, and headings inside features.

```text
studio/src/components/ui/
├── Button.tsx
├── IconButton.tsx
├── SectionHeader.tsx
├── StatusBadge.tsx
├── Switch.tsx
└── TextField.tsx
```

These components own common structure, accessibility, variants, and class names. Product features remain responsible for labels, state, and business behavior.

## Planned affected structure

```text
studio/
├── package.json
├── package-lock.json
└── src/
    ├── app/
    │   ├── App.tsx
    │   ├── NavigationPanel.tsx
    │   ├── ResizableWorkspace.tsx
    │   └── useResizablePanels.ts
    ├── components/
    │   └── ui/
    │       ├── Button.tsx
    │       ├── IconButton.tsx
    │       ├── SectionHeader.tsx
    │       ├── StatusBadge.tsx
    │       ├── Switch.tsx
    │       └── TextField.tsx
    ├── features/
    │   ├── logs/
    │   │   └── ServerLogs.tsx
    │   ├── models/
    │   │   └── ModelLibrary.tsx
    │   └── server/
    │       └── ServerSettings.tsx
    └── styles/
        └── global.css

ARCHITECTURE.md
DESIGN.md
docs/plan/tidestudio-light-ui-design-system.md
```

## File-by-file changes

### Create

- `studio/src/components/ui/Button.tsx`
  - Reusable primary, secondary, danger, and ghost button variants.
- `studio/src/components/ui/IconButton.tsx`
  - Compact icon-only action button with accessible label.
- `studio/src/components/ui/SectionHeader.tsx`
  - Shared title, eyebrow, description, icon, and action layout.
- `studio/src/components/ui/StatusBadge.tsx`
  - Compact neutral/success status treatment for the application header.
- `studio/src/components/ui/Switch.tsx`
  - Reusable accessible switch modeled after TideCode's light control.
- `studio/src/components/ui/TextField.tsx`
  - Shared text/number field with consistent label, hint, and input styling.
- `docs/plan/tidestudio-light-ui-design-system.md`
  - This implementation plan and verification record.

### Modify

- `studio/package.json`
  - Add Google Sans Flex font package.
- `studio/package-lock.json`
  - Update lockfile from dependency installation.
- `studio/src/app/App.tsx`
  - Use shared status UI and refined light application header.
- `studio/src/app/NavigationPanel.tsx`
  - Keep Models active, apply TideCode-like sidebar structure and spacing, and remove backend footer.
- `studio/src/app/ResizableWorkspace.tsx`
  - Refine splitter markup/classes for visually quiet resize hit areas.
- `studio/src/app/useResizablePanels.ts`
  - Keep current resizing behavior; adjust width constants only if needed for the new sidebar/inspector spacing.
- `studio/src/features/models/ModelLibrary.tsx`
  - Use shared header/button primitives and cleaner selected-row presentation.
- `studio/src/features/server/ServerSettings.tsx`
  - Use shared fields, switch, and buttons.
- `studio/src/features/logs/ServerLogs.tsx`
  - Use shared section header and light runtime surface treatment.
- `studio/src/styles/global.css`
  - Replace the dark palette with TideCode-derived light tokens and implement the shared component classes and spacing system.
- `DESIGN.md`
  - Record light-only default, TideCode-derived tokens/spacing, Models navigation, and reusable component rules.
- `ARCHITECTURE.md`
  - Record the shared `components/ui` presentation layer.

### Delete

- No files planned for deletion.

## Verification

1. Install/update frontend dependencies.
2. Run `npm run build`.
3. Run `cargo check` to ensure the frontend-only refactor did not disturb the Tauri application.
4. Run `npm run tauri dev` and confirm the application process reaches `target\debug\tidestudio.exe`.
5. Confirm there are no dark-theme selectors or dark-mode controls in the TideStudio frontend.
6. Confirm the sidebar keeps Models as the active destination and does not contain the Backend / llama.cpp footer.
7. Confirm the shared UI primitives are actually used by model, logs, server settings, and application status UI.
8. Confirm both panel separators remain draggable.

## Status

Implemented.

- TideCode-derived light palette and Google Sans Flex are applied.
- Models remains the active sidebar destination.
- The active sidebar item keeps its selected color on hover.
- The sidebar backend footer is removed.
- Shared reusable UI primitives are used across the current features.
- The TideCode `Switch.tsx` component is reused unchanged, with TideStudio CSS reproducing its Tailwind utility styling.
- Resize hit areas are invisible and overlap panel edges. The cursor is the only hover affordance.
- The center workspace panel is flat with no edge shadow.
- No dark-mode selectors or controls are present.
