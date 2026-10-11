# Faster Windows Release Build

## Intended result

Reduce the time spent generating the Windows NSIS installer without changing the bundled runtime contents or installer behavior.

## Approach

The release build currently spends most of its time compressing the large bundled CUDA and llama.cpp runtime with NSIS LZMA compression.

Switch NSIS compression to `zlib`, which is significantly faster to compress while still producing a compressed installer.

The tradeoff is a larger setup executable than LZMA.

## Files changed

- `studio/src-tauri/tauri.conf.json`
  - Set NSIS compression to `zlib`.
- `CHANGELOG.md`
  - Record the release packaging speed improvement.
- `AGENTS_LEARNING.md`
  - Record the intentional build-speed-over-minimum-size preference for Windows releases.
- `docs/plan/faster-windows-release-build.md`
  - Document the decision and validation.

## Verification

- Run `git diff --check`.
- Run `npm run release:windows` from `studio`.
- Measure total release build time.
- Confirm generated installer is `TideStudio_0.1.1_x64-setup.exe`.
- Record final installer size and SHA-256.
- Confirm generated NSIS script uses zlib compression.
- Confirm the custom in-place upgrade template remains active.
