# Full-Width Models Workspace and Custom Dropdown

## Goal

Remove the remaining global center-panel inset so the Models workspace uses the full center width, and replace the native select with a reusable custom dropdown component.

## Layout

- `.main-panel` becomes a neutral full-width/full-height page host with no content padding.
- Models owns its own compact top toolbar and full-bleed table.
- The model table touches the center panel's left and right boundaries.
- Server keeps readable content spacing through `.server-dashboard` page-specific padding.

## Custom dropdown

Replace the native `Select` implementation with a custom reusable `Dropdown`.

Behavior:

- text + chevron trigger
- no native `<select>`
- custom popover menu
- selected option styling
- closes on outside pointer press
- closes on Escape
- Arrow Up/Down, Home, End navigation
- Enter/Space selection
- returns focus to the trigger after selection/close

## Files

### Create

- `studio/src/components/ui/Dropdown.tsx`
- `docs/plan/full-width-models-custom-dropdown.md`

### Modify

- `studio/src/features/models/ModelLibrary.tsx`
- `studio/src/styles/global.css`
- `DESIGN.md`

### Delete

- `studio/src/components/ui/Select.tsx`

## Verification

1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm `.main-panel` has zero content padding.
4. Confirm the Models table spans the center panel horizontally.
5. Confirm Server retains page-specific padding.
6. Confirm no native `<select>` remains in the frontend.
7. Confirm the dropdown supports All, LLMs, Embeddings, and Drafters.

## Status

Implemented and verified.

The Models filter was subsequently removed from the current screen by product decision. The shared custom `Dropdown` remains available for future use.

- `npm run build` passes.
- `cargo check` passes.
- `.main-panel` has zero padding at all supported widths.
- Models uses a full-bleed table with only compact toolbar-local spacing.
- Server retains page-specific padding.
- The native `Select.tsx` component is removed.
- No native `<select>` remains in the frontend.
- The reusable custom `Dropdown` supports outside-click dismissal, Escape, Arrow Up/Down, Home, End, Enter/Space, and selected state.
