# Models Sticky Actions Column Fix

## Problem

The Actions column shifts near the far-right end of horizontal scrolling. Earlier styles removed the right row padding, but a later shared header/row override restored `padding-inline: 20px`, leaving an extra 20px beyond the sticky Actions cells.

## Approved Implementation

- Modify `studio/src/styles/global.css`: set the final header/row override to `padding-inline: 20px 0`; retain the existing identical sticky `right: 0` alignment and the right gutter inside both Actions cells.
- Modify `DESIGN.md` and `AGENTS_LEARNING.md`: record the final CSS precedence requirement so later overrides do not reintroduce the issue.
- Leave `studio/src/features/models/ModelLibrary.tsx`, model selection, and action-menu behavior unchanged.

## Approved Follow-up: Actions Button Alignment

- The sticky Actions column remains fixed after the padding correction, but the three-dot control still shifts visually.
- Remove the separate `position: relative` and elevated `z-index` from the `.model-actions` wrapper. Give it a fixed 20px square, with a centered 20px trigger and 14px SVG. The action menu remains a portal positioned independently of this wrapper.
- Keep the sticky column and menu behavior intact; update design guidance and validate again.

## Approved Structural Fix: Separate Actions Column

- The icon still shifts with horizontal scroll, even after the earlier padding and button wrapper corrections. Do not keep adjusting the icon inside a horizontally scrolling row.
- Modify `studio/src/features/models/ModelLibrary.tsx` to render the model data grid separately from an entire pinned Actions stack. Preserve the existing model selection, keyboard handling, and action-menu behavior. Mirror selected and hovered rows across the two stacks.
- Modify `studio/src/styles/global.css` so the shared table remains the sole horizontal/vertical scroller, the outer layout has an independent 72px Actions column with `position: sticky; right: 0`, and individual rows/buttons have no sticky positioning. Use matching 30px headers, 1px body separators, and 44px rows in both columns.
- Modify `DESIGN.md` and `AGENTS_LEARNING.md` to replace obsolete nested-sticky guidance with the shared-scroll, separate-column layout.

## Approved Final Layout: Full-width Scrollbar and Fixed Actions Pane

- Keep the 72px Actions pane completely outside horizontal scrolling. Synchronize only vertical movement between model rows and Actions rows.
- Add one dedicated horizontal scrollbar across the complete table width at the bottom, including beneath the Actions pane. Its scroll range must exactly match the model-data overflow and it must drive both the data rows and header horizontal offset.
- Keep the Actions button and its SVG stationary at every horizontal scroll position.
- Restore the Load Model sort segmented field to the shared compact design: content-sized outer field, 56px minimum options, 32px option height, 12px labels, 3px inset/gap, 12px outer radius, and 8px option radius.
- Validate the Actions geometry in headless Chrome at left, middle, and far-right scroll positions, then run the production build and `git diff --check`.

## Approved Scroll Stability Fix

- Remove bidirectional horizontal scroll synchronization between the model body and the dedicated bottom scrollbar. The bottom scrollbar is the only horizontal scroll source.
- Convert its scroll position into one shared CSS offset and translate the model header and model-body content together. Keep the data body itself horizontally non-scrollable.
- Absolutely anchor the full-width horizontal scrollbar to the bottom edge of the Models table so outer page/layout scrolling cannot move it vertically.
- Keep the Models page at exactly 100% height with overflow hidden so the table owns all internal scrolling.
- Validate at multiple table widths that columns move linearly with the scrollbar, Actions button/SVG X coordinates stay unchanged, and the scrollbar remains aligned to the table bottom.

## Validation

- Run `npm run build` from `studio`.
- Run `git diff --check`.
- Visual confirmation of horizontal scrolling in the running desktop app is still required to verify the pinned position at both ends.
