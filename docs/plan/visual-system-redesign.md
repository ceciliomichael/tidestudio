# TideStudio Visual System Redesign

## Intended result

Replace the current dashboard-like composition with a quieter desktop utility layout while preserving existing behavior. Keep the loaded-model card as a two-row component.

## Scope

- Remove the detached global top bar.
- Make the sidebar the only persistent application chrome and move Downloads activity into its footer.
- Use a compact fixed-default sidebar and one continuous working surface for main + inspector.
- Add page-level hierarchy for Model Search, Models, and Server.
- Flatten Model Search and Models into list/table rows with separators instead of individual cards.
- Simplify Server chrome and section surfaces while retaining the loaded-model two-row layout.
- Simplify inspectors and download-detail surfaces.
- Normalize radius, spacing, typography, borders, and accent usage.
- Remove obsolete late-stage size overrides where the same selectors are already defined by the new system.

## Files

- `studio/src/app/App.tsx`
- `studio/src/app/NavigationPanel.tsx`
- `studio/src/app/ResizableWorkspace.tsx`
- `studio/src/app/useResizablePanels.ts`
- `studio/src/features/downloads/DownloadsBrowser.tsx`
- `studio/src/features/models/ModelLibrary.tsx`
- `studio/src/features/server/ServerDashboard.tsx`
- `studio/src/styles/global.css`

## Verification

- `npm run build`
- `cargo test`
- `cargo fmt --check`
- `git diff --check`

## Implemented

- Removed the detached global header and moved Downloads activity to the sidebar footer.
- Changed the default navigation width to a compact 220px while retaining resize support.
- Unified main and inspector panes into one continuous work surface with fine separators.
- Added page-level hierarchy to Model Search, Models, and Server.
- Flattened Model Search and Models rows and reduced decorative borders/radii.
- Simplified Model Search and model inspectors into more open sections.
- Simplified Server status/actions and flattened endpoints/log surfaces.
- Preserved the loaded-model two-row layout while reducing nested borders and card decoration.
