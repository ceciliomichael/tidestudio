# Expandable Model Search Detail Panel

## Goal

Match the LM Studio interaction pattern for Model Search: browse a wide model list first, then expand a full model-detail pane only after the user selects a model.

## Behavior

- Searching does not auto-select the first repository.
- With no selected repository, Model Search keeps the normal workspace proportions.
- Clicking a repository opens and expands the right detail panel.
- Expanded detail targets roughly 58% of the usable workspace after navigation, while preserving a practical center-list width.
- The expanded right panel remains manually resizable.
- A close action in the detail header clears selection and collapses the panel.
- Switching away from Model Search returns to standard panel sizing.
- Server and Models use the existing standard sizing.

## Files

Modify:
- studio/src/app/App.tsx
- studio/src/app/ResizableWorkspace.tsx
- studio/src/app/useResizablePanels.ts
- studio/src/features/downloads/DownloadInspector.tsx
- studio/src/styles/global.css
- DESIGN.md
- AGENTS_LEARNING.md
- docs/plan/model-search-expand-detail-panel.md

## Verification

1. Run npm run build.
2. Confirm searching with no selected result leaves the right panel unexpanded.
3. Confirm clicking a repository expands the right panel.
4. Confirm closing repository details collapses the right panel.
5. Confirm expanded panel can still be resized.
6. Confirm Server and Models keep standard panel limits.

## Status

Implemented and verified.

- npm run build passes.
- Model Search no longer auto-selects the first search result.
- Browse mode collapses the right pane completely.
- Clicking a repository switches to an expanded detail layout targeting 58% of the workspace after navigation.
- The expanded right panel supports manual resizing up to 1100px.
- The detail header has a close action that clears selection and returns to browse mode.
- Server and Models continue using the standard panel limits.
