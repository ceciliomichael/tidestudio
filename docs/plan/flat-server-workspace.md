# Flat Server Workspace Plan

## Goal

Simplify the Server center workspace for the current design iteration.

- Remove the large Managed servers header block.
- Keep the running model surface at the top.
- Make the running model card full width.
- When no real server is running, render one clearly UI-only mock running model so the layout is visible during design.
- Keep real managed servers authoritative when they exist.
- Make API Logs a flat, full-width bottom panel rather than a floating rounded card.

## Behavior

Real runtime state remains unchanged.

If at least one real running server exists:
- render the real running server cards
- allow selection and stop actions
- show real logs

If no real running server exists:
- render one non-interactive mock running model card
- show mock metadata
- do not call backend stop/select actions from the mock
- show placeholder API log content only

## Files

Modify:
- studio/src/features/server/ServerDashboard.tsx
- studio/src/features/server/ServerLogsPanel.tsx
- studio/src/styles/global.css
- DESIGN.md
- docs/plan/flat-server-workspace.md

## Verification

1. Run npm run build.
2. Run cargo check.
3. Confirm Managed servers header is removed from ServerDashboard.
4. Confirm mock model is UI-only and cannot trigger backend actions.
5. Confirm running-model card spans full available center width.
6. Confirm API Logs has no floating card border/radius treatment.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- The old Managed servers and Launch a model framing is removed from the center workspace.
- A full-width UI-only Qwen3 8B preview card is rendered when no real runtime exists.
- The preview Stop action is disabled and does not call backend actions.
- Real running servers replace the preview and retain working selection/stop behavior.
- API Logs is full width with only flat separators, no rounded floating-card container.
