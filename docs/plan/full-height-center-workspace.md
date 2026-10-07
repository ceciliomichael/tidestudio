# Full-Height Center Workspace Plan

## Goal

Make TideStudio's primary center workspace behave more like the familiar LM Studio desktop layout shown in the provided reference: a full-height, square-edged working panel between persistent side regions.

This keeps TideStudio's existing light design system, Server/Models navigation, and invisible draggable resize edges.

## Changes

- Remove the center panel's vertical margin.
- Remove the center panel corner radius.
- Remove the enclosing four-sided card border treatment.
- Keep thin left/right separators so the center workspace remains visually distinct from navigation and inspector surfaces.
- Keep the center surface white and full-height within the workspace.
- Preserve existing content padding inside the center workspace.
- Preserve invisible edge resize hit areas with cursor-only feedback.

## Files

### Modify

- `studio/src/styles/global.css`
  - Convert `.main-panel` from a rounded inset surface to a full-height square workspace.
- `DESIGN.md`
  - Record the full-height center workspace rule.
- `docs/plan/full-height-center-workspace.md`
  - Track implementation and verification.

### Create

- `docs/plan/full-height-center-workspace.md`

### Delete

- None.

## Verification

1. Run `npm run build`.
2. Confirm `.main-panel` has no margin, border radius, or shadow.
3. Confirm only left/right boundaries separate the center from side panels.
4. Confirm panel resizing remains invisible and functional.

## Status

Implemented and verified.

- `npm run build` passes.
- `.main-panel` has no margin, rounded corners, or shadow.
- The center workspace is full-height with only left/right boundaries.
- Resize hit areas remain invisible with cursor-only feedback.
