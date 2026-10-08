# Server Running Cards and API Logs Plan

## Goal

Restructure the Server center workspace so runtime state is easier to scan:

- keep the existing launch section
- replace the Active Registry row list with running-model cards
- move runtime/API logs from the right inspector into a dedicated bottom panel in the center workspace
- keep the right inspector focused on compact selected-server metadata only

## Center workspace

```text
Server
├── Launch a Model
│   └── existing launch rows
├── Running Models
│   └── server cards
│       ├── running status + model name
│       ├── backend / localhost port / PID
│       └── actions aligned far right
│           └── Stop
└── API Logs
    ├── selected model / endpoint heading
    └── live llama-server output
```

Selecting a running-model card selects the server and therefore controls which logs are shown below.

## Right inspector

The Server right inspector will keep:

- selected model name
- backend / localhost endpoint
- status
- port
- PID

It will no longer contain:

- runtime logs
- stop action

Those controls belong to the running card and center log panel.

## Planned structure

```text
studio/src/
├── app/
│   └── App.tsx
├── features/server/
│   ├── ServerDashboard.tsx
│   ├── ServerLogsPanel.tsx
│   └── ServerInspector.tsx
└── styles/
    └── global.css

ARCHITECTURE.md
DESIGN.md
docs/plan/server-running-cards-api-logs.md
```

## File changes

### Create

- `studio/src/features/server/ServerLogsPanel.tsx`
  - Center-panel live log surface for the currently selected managed server.
- `docs/plan/server-running-cards-api-logs.md`
  - Implementation and verification record.

### Modify

- `studio/src/features/server/ServerDashboard.tsx`
  - Render running servers as cards instead of registry rows.
  - Add selected state and stop action at the far right.
  - Compose the new API log panel under the running models.
- `studio/src/features/server/ServerInspector.tsx`
  - Remove logs and stop action.
  - Keep runtime metadata only.
- `studio/src/app/App.tsx`
  - Pass logs into `ServerDashboard` instead of `ServerInspector`.
- `studio/src/styles/global.css`
  - Add running-card and center log-panel styling.
  - Remove obsolete right-inspector log styles when no longer used.
- `ARCHITECTURE.md`
  - Update Server page responsibility.
- `DESIGN.md`
  - Record the running-card + bottom-log layout.

### Delete

- None.

## Verification

1. Run `npm run build`.
2. Run `cargo check`.
3. Confirm running servers render as cards.
4. Confirm stop action is at the far right of each running card.
5. Confirm selecting a card changes the API Logs panel.
6. Confirm logs no longer render in the right inspector.
7. Confirm stopping a server removes its card and clears/reselects logs correctly.

## Status

Implemented and verified.

- `npm run build` passes.
- `cargo check` passes.
- Running servers render as selectable cards.
- Stop actions sit at the far right of each running-model card.
- The selected running card drives the center API Logs panel.
- Runtime logs no longer render in the right inspector.
- The right inspector is metadata-only.
- Server selection now prefers currently running entries, so stopping the selected server clears or moves selection to another running server.
