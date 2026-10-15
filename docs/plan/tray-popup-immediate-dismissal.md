# Immediate Windows tray-popup dismissal

## Requested result

Port TideCode's early-dismissal behavior to TideStudio without changing the custom tray menu's design. Close on the tray's mouse-down or focus loss instead of waiting for mouse-up, then consume that gesture's mouse-up so it cannot reopen the popup. Keep ordinary outside-click dismissal.

## Affected structure and changes

```text
AGENTS_LEARNING.md                                      modified
ARCHITECTURE.md                                         modified
DESIGN.md                                               modified
docs/plan/tray-popup-immediate-dismissal.md               created
studio/src-tauri/src/tray.rs                             modified
```

- `studio/src-tauri/src/tray.rs`: own the pending closing gesture in tray-local managed state; close on right-button down or focus loss over the tray; suppress only the matching mouse-up; allow the following deliberate click to open normally; bound empty tray rectangles around the actual click. Add Rust unit tests for gesture ordering and hit areas. Preserve the existing transparent, preloaded WebView and CSS visibility mechanism.
- `ARCHITECTURE.md`: document tray-local gesture ownership and visibility flow.
- `DESIGN.md`: clarify that tray presses dismiss early without a mouse-up reopen; preserve the current border, corners, sizing, colors and labels.
- `AGENTS_LEARNING.md`: record the confirmed request to use early dismissal and retain the custom popup.
- This plan records the narrowly scoped port requested by the user; no renderer, model, gateway or public IPC changes are required.

## Verification

Run the tray Rust unit tests, Rust formatting check for the edited source, and `git diff --check` for the affected files. Compile through the normal Rust test build. Confirm that existing unrelated working-tree changes remain intact. Native Windows visual timing requires a live application retest and must not be inferred from unit tests.
