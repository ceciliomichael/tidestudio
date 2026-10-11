# Load Model Startup Readiness

## Intended result

Make Server > Load Model immediately usable during application startup instead of rendering as disabled while the full GGUF metadata discovery pass is still running.

Also keep the Size column on the far-right edge of the Load Model catalog.

## Approach

The startup delay comes from `list_models` recursively scanning installed GGUFs and enriching each model from GGUF metadata before React receives the first local-model catalog.

Keep that authoritative discovery behavior, but remove it from the critical UI path:

1. Restore the last completed local model catalog and resolved per-model load configs from the existing SQLite UI-preferences store.
2. Show that cached catalog immediately.
3. Run the normal filesystem/GGUF discovery in the background.
4. Replace the cached catalog with the authoritative discovery result and refresh the cache.
5. Keep Load Model enabled while the initial refresh is in progress. If no cached models exist and the user opens it immediately, show a compact loading state instead of a disabled toolbar button.
6. Once discovery completes with zero models, disable Load Model as before.

For the table layout, keep the existing compact columns but move the action cell before Size and right-align Size at the table edge.

## Files changed

- `studio/src/app/App.tsx`
  - Add the SQLite-backed local catalog cache.
  - Track initial local-model discovery readiness.
  - Restore cache before the full background refresh.
  - Refresh the cache after successful discovery.
- `studio/src/features/server/ServerDashboard.tsx`
  - Keep Load Model enabled during initial discovery.
  - Pass discovery readiness into the modal.
- `studio/src/features/server/LoadModelDialog.tsx`
  - Show a loading/empty state when no rows are currently available.
  - Move Size to the far-right column.
- `studio/src/styles/global.css`
  - Right-align the Size column and style the empty/loading catalog state.
- `DESIGN.md`
  - Record the far-right Size layout and immediate Load Model behavior.
- `ARCHITECTURE.md`
  - Record the SQLite startup catalog cache and background authoritative refresh.
- `CHANGELOG.md`
  - Document the user-visible startup and table improvements.
- `AGENTS_LEARNING.md`
  - Record the durable startup interaction requirement.
- `docs/plan/load-model-startup-readiness.md`
  - Record this implementation.

## Tradeoffs

The restored catalog is intentionally a last-known-good snapshot and can briefly be stale if model files are changed outside TideStudio between launches. The normal GGUF discovery still runs immediately and replaces the cache with the authoritative state.

No inference or model-load backend behavior is changed.

## Verification

- Run `git diff --check`.
- Run `npm run build` from `studio`.
- Confirm TypeScript compiles.
- Confirm Load Model is not disabled while initial model discovery is pending.
- Confirm zero-model state disables Load Model after discovery completes.
- Confirm cached models are restored before the full metadata refresh when cache exists.
- Confirm the Load Model Size column renders at the far-right edge.
