# Workspace panel size persistence

## Intended result

- Persist the user's left sidebar width and right inspector widths in the existing SQLite `ui_preferences` store.
- Restore those widths before the React workspace mounts so startup does not render default panel sizes and then jump to saved sizes.
- Keep one shared left width plus separate remembered right widths for the standard inspector and the wider Model Search detail inspector.
- Persist only after a user resize finishes, not on every pointer move or automatic viewport clamp.

## Planned project tree

```text
studio/src/main.tsx
studio/src/app/App.tsx
studio/src/app/ResizableWorkspace.tsx
studio/src/app/useResizablePanels.ts
studio/src/app/workspacePanelPreferences.ts
DESIGN.md
AGENTS_LEARNING.md
docs/plan/workspace-panel-size-persistence.md
```

## File changes

- `workspacePanelPreferences.ts`: SQLite preference key, persisted shape, defaults, and defensive parser.
- `main.tsx`: hydrate panel widths from SQLite before the first React render.
- `App.tsx`: pass hydrated widths down and save resize commits through `setUiPreference`.
- `ResizableWorkspace.tsx`: forward persistence inputs to the resize hook.
- `useResizablePanels.ts`: initialize first paint from saved widths, remember widths per inspector mode, and commit on pointer-up.
- `DESIGN.md` / `AGENTS_LEARNING.md`: record the no-flash persistence behavior.

## Verification

- Production TypeScript/Vite build and `git diff --check`.
- Component/browser checks for first-render saved grid widths, standard/detail right-width separation, left-width reuse in Settings/Downloads, and commit-on-resize behavior.

## Results

- Browser fixture passed with saved widths `left=268`, `standardRight=410`, `detailRight=760`: the standard workspace rendered 268/410 immediately, Model Search detail restored 760, and Settings reused the 268px left width with no right panel.
- Resize simulation confirmed no persistence callback during pointer movement and exactly one committed preference on pointer-up; the committed object preserved all three remembered widths.
- Startup hydration is performed in `main.tsx` before `createRoot().render`, so React never mounts the workspace at default geometry when a SQLite preference exists.
- Production build and `git diff --check` passed after implementation. The existing Vite bundle-size warning remains non-blocking.
