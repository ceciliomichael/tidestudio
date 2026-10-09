# Non-blocking model load lifecycle

## Goal

Loading a llama.cpp model must never hold TideStudio's shared server registry lock for the readiness window. The UI should immediately show the worker as Loading, stay responsive while llama.cpp loads, then show Ready after health registration succeeds.

## Approach

- Split ServerRegistry startup into:
  - quick worker spawn/registration with lifecycle=loading
  - short lifecycle/process checks
  - ready transition
- Keep readiness HTTP polling outside all registry/gateway mutexes.
- Have start_server return immediately after process spawn.
- Launch the readiness/API gateway registration work in a detached async task.
- Emit a server-start-failed event if readiness or registration fails.
- Extend ServerStatus with lifecycle state and expose it to React.
- Keep loading workers in the Loaded Models list and render Loading instead of Ready.
- Continue allowing Stop while loading.
- Keep 1-second polling, now safe because list_servers no longer waits behind a 120-second lock.

## Verification

- cargo fmt
- cargo test
- cargo fmt --check
- npm run build
- git diff --check

## Implemented

- ServerRegistry records workers as `loading` or `ready`.
- `start_server` returns immediately after the llama.cpp process is spawned.
- Readiness polling runs in a separate task without holding registry or gateway locks across waits.
- Ready state is pushed to React with `server-status-changed`.
- Startup failures are pushed with `server-start-failed` and clean up the worker.
- Server list/status/log/stop commands run on blocking worker threads instead of occupying the synchronous UI command path.
- Loading workers remain visible and stoppable in Loaded Models.
- RAM sampling refreshes only the target llama.cpp PID.
