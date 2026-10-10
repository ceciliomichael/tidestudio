# Downloads navigation and panel borders

Approved change: replace disabled Presets with a real Downloads destination in the main navigation; move Settings alone to the footer without a divider; convert the download activity popover into a main-panel page. Follow-up: add a visible top border to the workspace panels.

## Files

- `studio/src/app/NavigationPanel.tsx`: separate Model Search (`modelSearch`) from Downloads (`downloads`), make Settings the bottom navigation action, and show a live active-download badge.
- `studio/src/app/App.tsx`: update page routing and two-panel mode, pass download data to the new page, keep clearing completed activity, remove the popover.
- `studio/src/features/downloads/DownloadActivityPage.tsx`: new full-height, scrollable page with live active cards and completed history.
- `studio/src/features/downloads/DownloadActivityPopover.tsx`: delete obsolete popover.
- `studio/src/styles/global.css`: keep existing cards' visual language; add page layouts, an undivided Settings footer, and top borders on all visible workspace panels.
- `DESIGN.md` and `AGENTS_LEARNING.md`: update project design guidance.
- `docs/plan/downloads-navigation.md`: implementation and validation notes.

## Validation

- TypeScript / Vite production build and `git diff --check`.
- Responsive light/dark browser layout checks for navigation, page cards, panel borders, scroll containment and footer without separator.
- Verify Model Search still has its existing detail inspector while Downloads and Settings show two panes.

## Completed validation

- Chrome React component tests passed at 1000×720 and 1600×1000 window sizes in light and dark modes: correct navigation order, active download badge, Downloads and Model Search navigation, bottom Settings navigation without a divider, fixed Downloads header, scrollable activity list, Clear completed behavior, and top borders on navigation, main, inspector and Settings panels.
- `npm run build` and `git diff --check` passed. The existing Vite bundle-size warning is non-blocking.
- The temporary Vite test page and test server are removed after verification.
