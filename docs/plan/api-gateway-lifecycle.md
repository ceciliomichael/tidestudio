# API gateway lifecycle and occupied port recovery

Approved outcome: remove the verified orphaned gateway from the previous TideStudio session, start and verify the current application's gateway, prevent orphaned Windows gateways, and surface a specific port-in-use error.

## Affected project structure

```text
tidestudio/
  studio/
    src-tauri/src/core/gateway/
      process.rs                 # modify: supply owning TideStudio process ID
      manager.rs                 # modify: reject occupied configured ports before spawning
    api-gateway/cmd/tidestudio-api-gateway/
      main.go                    # modify: supervise parent and close listener on exit
      parent_windows.go          # create: Windows process-handle exit watcher
      parent_other.go            # create: non-Windows portability implementation
      parent_windows_test.go     # create: Windows supervisor tests
  ARCHITECTURE.md                # modify: document gateway lifecycle ownership
  AGENTS_LEARNING.md             # modify: avoid orphan gateway conflict
  docs/plan/api-gateway-lifecycle.md # create: this plan and checks
```

## Approach

1. Verify the stale gateway binary, PID, parent, and port before stopping only that process. Do not terminate unrelated processes.
2. Pass the native TideStudio process ID when launching the Go gateway. On Windows hold a handle to the owning parent and close the HTTP listener on its termination, even after an unexpected exit. If the specified parent cannot be opened, fail startup closed.
3. Check port availability before starting a new managed gateway; return a clear port-conflict error instead of appearing stopped. Do not adopt or kill other processes occupying a configured port.
4. Rebuild the native app and gateway, verify the current process owns a healthy gateway, and ensure UI status is driven by the managed process.

## Verification

- Go tests including parent-exit behavior; Rust compile and gateway port-conflict unit test; production build; `git diff --check`.
- Verify the port's actual owner, current gateway health, parent ownership, and UI status when possible.

## Results

- Verified and stopped only orphaned gateway PID 3116 after confirming its missing parent and TideStudio executable path.
- `go test ./...` passed, including the Windows parent process exit test; `cargo fmt --all --check` and the Rust occupied-port test passed.
- `npm run build` passed (with the existing non-blocking bundle-size warning).
- The native development app restarted automatically after the Rust changes: TideStudio PID 35468 launched gateway PID 20156. Windows confirmed the child owns the public port 3456; `/health` and `/v1/models` return HTTP 200, and the latter includes the loaded Laya model.
- The status-label UI is wired to `gateway_status`, which checks the child launched by the current Rust app; an external orphan's HTTP health is intentionally not accepted as managed status.
