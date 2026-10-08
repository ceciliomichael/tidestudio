# Server Top Toolbar Plan

## Goal

Add an LM Studio-style control strip at the top of the Server center workspace without changing the docked logs layout.

## Layout

```text
Server center
├── top toolbar
│   ├── Status: Running/Stopped + read-only switch
│   ├── Server Settings
│   ├── mcp.json
│   ├── Reachable at: http://...
│   ├── Copy endpoint
│   └── Load Model
├── Loaded Models
│   └── existing running/mock model cards
├── Supported Endpoints
└── API Logs bottom dock
```

## Behavior

- Status reflects whether any real managed server is currently running.
- Server Settings scrolls/focuses the existing right-inspector settings section.
- mcp.json is visible but disabled until MCP configuration support exists.
- Reachable endpoint follows the selected real server; mock preview uses its preview localhost endpoint.
- Copy copies the endpoint to the clipboard.
- Load Model switches to the Models page.
- Existing mock/real runtime behavior remains unchanged.

## Files

Modify:
- `studio/src/features/server/ServerDashboard.tsx`
- `studio/src/app/App.tsx`
- `studio/src/styles/global.css`
- `DESIGN.md`
- `docs/plan/server-top-toolbar.md`

## Verification

1. Run `npm run build`.
2. Confirm toolbar renders before Loaded Models.
3. Confirm Load Model changes to Models.
4. Confirm mcp.json is disabled.
5. Confirm endpoint copy action is wired.

## Status

Implemented and verified.

- `npm run build` passes.
- The toolbar renders above Loaded Models.
- Status reflects real managed runtime state.
- Server Settings scrolls to the right-inspector settings section.
- `mcp.json` is visible but disabled until MCP configuration support exists.
- Reachable endpoint has a clipboard copy action.
- Load Model switches to the Models page.
