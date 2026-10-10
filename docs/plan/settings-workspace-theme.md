# Settings workspace parity and native theme

Approved result: Settings uses the same left-sidebar sizing and resize interaction as the standard workspace, but displays only left and main panels. The native Windows frame follows the existing Light, Dark and System appearance selection.

## Planned structure and changes

```text
tidestudio/
  studio/
    src/
      app/
        App.tsx                  (modify: select Settings-specific layout)
        ResizableWorkspace.tsx   (modify: two-pane Settings grid)
        useResizablePanels.ts    (modify: resizable Settings sidebar; retain left width)
      lib/
        appearance.ts            (modify: native window theme/background synchronization)
      styles/
        global.css               (modify: match default workspace panel shape/background)
    src-tauri/
      src/
        lib.rs                    (modify: register caption-color command)
        commands/
          mod.rs                  (modify: export native window command)
          window.rs               (create: Windows DWM caption/border/text colors)
      gen/schemas/
        capabilities.json         (regenerated: updated permissions)
      capabilities/
        default.json             (modify: minimum Tauri window theme/background permissions)
  DESIGN.md                      (modify: layout and window-color behavior)
  AGENTS_LEARNING.md             (modify: project UI lessons)
  docs/plan/
    settings-workspace-theme.md  (create: this approved plan and validation record)
```

## Implementation

- Reuse standard 220px initial sidebar with 196–280px resize limits and retain its width on page transitions. Keep the model-search browse behavior unchanged.
- Omit the right pane and divider in Settings; restore standard main-panel border and top-left radius. Keep General and Updates content.
- Synchronize the native Tauri window theme and background with the existing application appearance preference. System mode tracks operating-system appearance changes; browser-only previews remain supported. The Tauri background setter alone does not recolor the Windows native title bar; use Windows DWM caption/border/text attributes on supported Windows versions, with native OS styling fallback elsewhere. Derive the caption fill from the rendered `--color-sidebar` token to prevent palette drift.

## Validation

- Test sidebar dragging, mode switching, two-pane geometry and theme style in representative viewport sizes and both themes.
- Run `npm run build`, `git diff --check`, and applicable Tauri capability/schema checks.

Validation: frontend production build and TypeScript passed; Tauri theme/background capability checks passed; `cargo check --offline --target-dir target-theme-check --quiet`, `cargo fmt --all --check`, and `git diff --check` passed. Browser geometry and theme-color checks passed at 1300×850 in light and dark modes (220px sidebar, two-pane grid, 16px main corner radius, matching sidebar token). Temporary browser test and Rust build directory were deleted. Native DWM caption APIs require Windows support, with default native styling as fallback. A restart of the native Tauri process is needed to load the new Rust command.
