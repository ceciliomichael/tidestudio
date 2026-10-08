# Model Search and Download Activity Popover Plan

## Goal

Refine the Hugging Face experience so the search page is strictly for model discovery, while download state moves into a global header popover.

## Model Search

- Rename visible navigation/page label from Downloads to Model Search.
- Keep internal route id as `downloads` for now to avoid unnecessary churn.
- Remove the download progress card from the search page.
- Remove the Search button.
- Debounce search input by 350ms.
- Keep page title/search/results heading fixed.
- Keep only the repository list scrollable.
- Add 8px spacing above the first repository item.
- Retain dense rounded repository rows similar to the LM Studio reference.

## Header download activity

Add a download icon next to the server status badge.

Clicking it opens a popover with:
- active downloads
- completed downloads
- model/repository name
- file name
- downloaded bytes / total bytes
- percentage
- live download speed for active downloads
- progress bar
- Clear action for completed items

Download activity is derived from the existing `model-download-progress` events. Speed is calculated in the frontend from byte deltas over time.

## Files

Create:
- `studio/src/features/downloads/DownloadActivityPopover.tsx`

Modify:
- `studio/src/features/downloads/types.ts`
- `studio/src/features/downloads/DownloadsBrowser.tsx`
- `studio/src/app/NavigationPanel.tsx`
- `studio/src/app/App.tsx`
- `studio/src/styles/global.css`
- `DESIGN.md`
- `AGENTS_LEARNING.md`
- `docs/plan/model-search-download-activity.md`

## Verification

1. Run `npm run build`.
2. Confirm no Search button remains.
3. Confirm typing triggers debounced search.
4. Confirm Model Search contains no download-progress card.
5. Confirm the first repository row has 8px space below the results divider.
6. Confirm header download icon opens/closes the activity popover.
7. Confirm active download rows show speed, size, percentage, and progress.
8. Confirm completed items can be cleared.

## Status

Implemented and verified.

- `npm run build` passes.
- Visible navigation/page naming is Model Search.
- Model Search has no Search button and uses a 350ms debounce.
- The old in-page download progress card is removed.
- Only the repository results list scrolls.
- The list has 8px spacing between the results divider and the first repository row.
- The main header has a download icon beside server status.
- The download popover shows active/completed items, downloaded/total size, percentage, live speed, and progress.
- Completed entries can be cleared.
