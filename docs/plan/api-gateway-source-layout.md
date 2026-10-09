# API gateway source-layout cleanup

## Goal

Remove the misleading SDK-style naming and make the Go component clearly part of the TideStudio application. Keep behavior unchanged while moving the source, build output, command name, scripts, runtime lookup, and documentation to API-gateway terminology.

## Layout

- `studio/api-gateway/`: Go source module.
- `studio/api-gateway/cmd/tidestudio-api-gateway/`: executable entrypoint.
- Go module: `tidestudio/api-gateway`.
- `studio/runtime/api-gateway/tidestudio-api-gateway[.exe]`: generated runtime binary.
- `studio/scripts/build-api-gateway.mjs`: build script.
- npm task: `build:api-gateway`.

## UI cleanup

- Remove the Load Model footer and “Manually choose model load parameters” control.
- Close the Load Model modal immediately when a model load is started.

## Compatibility

- Public gateway HTTP routes, environment variables, worker registration protocol, and Rust gateway manager semantics remain unchanged.
- Only source/build/runtime naming and file placement change.

## Verification

- `go test ./...`
- `go vet ./...`
- `cargo test`
- `cargo fmt --check`
- `npm run build`
- `git diff --check`
- repository search for legacy source, build-task, and runtime binary names

## Implemented

- Moved the Go source into `studio/api-gateway/`.
- Renamed the Go module to `tidestudio/api-gateway`.
- Renamed the executable entrypoint to `tidestudio-api-gateway`.
- Renamed the build task to `build:api-gateway`.
- Renamed the build script to `studio/scripts/build-api-gateway.mjs`.
- Moved generated runtime output to `studio/runtime/api-gateway/`.
- Updated Rust runtime resolution and API-gateway error messages.
- Updated architecture and implementation-plan terminology.
- Removed the obsolete Load Model footer/manual-parameter control.
- Load Model now closes immediately when a model load is started.
