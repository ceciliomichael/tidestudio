# Download Progress UI Refinement Plan

## Goal

Make model-download progress readable and stable in both Model Search and the global download popover.

## Changes

### Model Search download buttons
- Use the per-file global download activity state instead of one shared progress value.
- While a file is downloading, replace the `Downloading` label with its current percentage, for example `42%`.
- Keep the button disabled while that exact file is active.

### Header download popover
- Redesign active rows around stable, readable metrics:
  - repository/model name
  - filename
  - percentage badge
  - transfer speed
  - downloaded amount and total size
  - progress bar
- Use tabular numbers and fixed metric regions to prevent layout jitter.
- Make completed rows quieter and more compact.
- Keep Clear for completed history.

### Progress update cadence
- Do not repaint the UI on every network chunk.
- Throttle visible progress updates to roughly 400ms.
- Calculate speed from byte deltas over the same sampling interval and smooth it with the previous sample.
- Flush completion immediately.

## Files

Modify:
- `studio/src/app/App.tsx`
- `studio/src/features/downloads/DownloadInspector.tsx`
- `studio/src/features/downloads/DownloadActivityPopover.tsx`
- `studio/src/styles/global.css`
- `DESIGN.md`
- `AGENTS_LEARNING.md`
- `docs/plan/download-progress-ui-refinement.md`

## Verification

1. Run `npm run build`.
2. Confirm active file buttons show percentage instead of `Downloading`.
3. Confirm multiple concurrent files can each show their own progress.
4. Confirm visible progress/speed updates are throttled and do not jitter every chunk.
5. Confirm completed rows remain readable and can be cleared.

## Status

Implemented and verified.

- `npm run build` passes.
- Active file buttons show their own percentage rather than `Downloading`.
- Multiple concurrent file downloads resolve progress by download id.
- Visible speed/progress sampling is throttled to roughly 400ms.
- The header popover uses stable percentage, speed, and downloaded-size regions with tabular numeric rendering.
- Completed rows are compact and remain clearable.
