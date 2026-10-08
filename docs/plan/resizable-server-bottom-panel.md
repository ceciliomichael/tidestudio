# Resizable Server Bottom Panel Plan

## Goal

Turn Server center into a vertical runtime workspace with:
- a scrollable running-model region above
- three UI-only mock running models when no real runtime exists
- margin around the running-model cards
- an API Logs panel docked to the bottom
- a draggable horizontal resize handle
- a collapsible API Logs header

## Layout

```text
Server center
├── Running model region
│   ├── margin top/right/left/bottom
│   ├── mock/real card
│   ├── mock/real card
│   └── mock/real card
├── horizontal resize handle
└── API Logs bottom panel
    ├── collapsible header
    └── scrollable output
```

## Behavior

- Expanded API Logs defaults to about 280px high.
- Dragging the horizontal separator resizes the log panel.
- The log panel is clamped so both top and bottom regions remain usable.
- Collapsing leaves only the API Logs header visible.
- Expanding restores the previous expanded height.
- Three mock models render only when no real server is running.
- Mock cards remain UI-only and cannot call backend lifecycle actions.
- Real running servers replace all mock cards.

## Files

Create:
- `studio/src/features/server/useResizableLogsPanel.ts`

Modify:
- `studio/src/features/server/ServerDashboard.tsx`
- `studio/src/features/server/ServerLogsPanel.tsx`
- `studio/src/styles/global.css`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `docs/plan/resizable-server-bottom-panel.md`

## Verification

1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm three mock cards render when there are no real running servers.
4. Confirm the model region has margin on all sides.
5. Confirm API Logs is the bottom flex region.
6. Confirm the horizontal separator changes log-panel height.
7. Confirm collapse leaves only the log header.
8. Confirm expand restores the previous height.
9. Confirm mock controls cannot call backend lifecycle actions.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- Three mock running-model cards render when no real runtime exists.
- Running-model cards sit inside an inset, independently scrollable top region.
- API Logs is docked to the bottom of the Server center workspace.
- The horizontal separator resizes the expanded logs panel.
- Collapsing leaves only the API Logs header visible.
- Expanding restores the prior expanded height.
- Mock Stop controls remain disabled and cannot call backend lifecycle actions.
