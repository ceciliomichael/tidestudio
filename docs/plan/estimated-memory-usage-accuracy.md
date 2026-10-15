# Estimated Memory Usage Accuracy Plan

## Goal

Make the pre-load memory card materially more useful for llama.cpp models without presenting a prediction as an exact RAM or VRAM measurement.

Implemented: GGUF tensor ranges, CPU/GPU weight placement, supported homogeneous-attention KV estimates, and explicit unknown states. Runtime comparison remains an empirical check, not an accuracy guarantee.

UI adjustment: the expanded breakdown and explanatory notes were removed. The pre-load card retains the original compact Beta design with only GPU and Total values; the improved estimator remains internal and responds to context and GPU offload settings.

## Current behavior and diagnosis

`studio/src/features/models/modelMemory.ts` currently:

- Estimates GPU weights as `GGUF file size × selected GPU layers / model layer count`. This assumes all layers have equal-sized weights and does not model the output layer or non-layer tensors separately.
- Estimates KV cache as one F16 cache with one set of attention dimensions repeated across every model layer.
- Adds the entire KV estimate to GPU memory whenever KV offload is enabled, even when no model layers are offloaded or only some layers are on the GPU.
- Shows `Total` as target model file size, plus the selected draft model file when applicable, plus the target KV-cache estimate. This excludes llama.cpp output/compute buffers and backend allocations, so it is not total runtime memory.
- Can produce a number even when required GGUF metadata is absent; some missing-metadata paths yield zero while others assume the whole file is GPU-resident.

The current UI defaults are context 4,096, 99 GPU layers, and KV offload enabled. The pinned llama.cpp `b11429` runtime reports model buffers, KV buffers, output buffers, and compute buffers separately. Its KV-cache data type defaults to F16, but it supports other K/V types; batch, microbatch, context, parallel slots, and attention architecture also affect allocations. Therefore, a file-size/layer-ratio heuristic cannot reliably represent the loaded process.

## Recommended approach

1. **Use GGUF tensor metadata for weights.** During the existing header/tensor-info pass, calculate stored tensor bytes by model layer and separately account for tensors not assigned to repeating layers. Do not read tensor payloads. Keep the compact per-layer profile in the model catalog rather than retaining one entry per tensor.
2. **Follow llama.cpp placement rules.** Calculate CPU/GPU weight estimates from the selected offload count using the pinned runtime's layer placement, including its output-layer behavior. Do not infer placement by multiplying whole-file size by a layer fraction.
3. **Estimate KV per layer.** Use each layer's supported attention/KV dimensions, the effective context and cache types, GPU offload placement, and the KV-offload setting. For unsupported or incomplete architecture metadata, display the component as unavailable/low-confidence instead of inventing zero or whole-file values. Account for memory-affecting extra arguments when recognized; otherwise flag the estimate as partial.
4. **Make the UI labels match what is estimated.** Show model weights and KV cache as separate CPU/GPU components. Rename `Total` to a precise subtotal such as `Model + KV`; retain the Beta marker and a short note that runtime/driver compute and output buffers are excluded. Do not claim exact system RAM or VRAM.
5. **Validate against real runtime allocations.** Use the pinned llama.cpp startup log's per-backend model/KV/output/compute buffer values as the comparison source. The current server process-memory field is a post-load process metric, not GPU telemetry or a pre-load estimate; do not mix it into this card in this change.

## Planned project structure

```text
studio/
├── package.json
├── package-lock.json
├── vitest.config.ts
├── src-tauri/src/core/models/
│   ├── discovery.rs
│   ├── gguf.rs
│   ├── memory_profile.rs
│   ├── mod.rs
│   └── types.rs
├── src/app/App.tsx
├── src/lib/tauri.ts
├── src/features/models/
│   ├── modelMemory.ts
│   ├── modelMemory.test.ts
│   └── types.ts
├── src/features/server/
│   └── LoadModelSettingsPage.tsx
└── src/styles/global.css

ARCHITECTURE.md
DESIGN.md
CHANGELOG.md
docs/plan/estimated-memory-usage-accuracy.md
```

## File-by-file changes

### Create

- `studio/vitest.config.ts`
  - Configure a small test runner for deterministic frontend estimator tests.
- `studio/src/features/models/modelMemory.test.ts`
  - Cover per-layer weight placement, KV placement/cache types, draft weights, and missing-metadata behavior.
- `studio/src-tauri/src/core/models/memory_profile.rs`
  - Scan GGUF tensor info without loading payloads, group on-disk weights and test incomplete files.

### Modify

- `studio/src-tauri/src/core/models/gguf.rs`
  - Extend the tensor-info pass to derive compact per-layer and non-layer stored-weight byte totals; add parser/profile unit tests.
- `studio/src-tauri/src/core/models/types.rs`
  - Add the serialized memory-profile data required by the frontend.
- `studio/src-tauri/src/core/models/discovery.rs`
  - Attach the profile to discovered GGUF catalog entries.
- `studio/src-tauri/src/core/models/mod.rs`
  - Expose the focused memory profile module.
- `studio/src/lib/tauri.ts`
  - Type the IPC memory profile.
- `studio/src/app/App.tsx`
  - Adapt discovered model memory profiles and support stale cached catalogs.
- `studio/src/features/models/types.ts`
  - Add the typed catalog memory profile.
- `studio/src/features/models/modelMemory.ts`
  - Replace whole-file proportional estimates with component calculations based on the profile and effective load settings; represent unknown estimates explicitly.
- `studio/src/features/server/LoadModelSettingsPage.tsx`
  - Render weight/KV and CPU/GPU estimates with accurate subtotal wording and uncertainty notes.
- `studio/src/styles/global.css`
  - Style the revised component breakdown and unavailable/low-confidence state.
- `studio/package.json`
  - Add the focused estimator-test command and Vitest development dependency.
- `studio/package-lock.json`
  - Record the test dependency lockfile update.
- `ARCHITECTURE.md`
  - Document the memory profile's source and the estimator's explicit limits after implementation.
- `DESIGN.md`
  - Update the Load Model memory-card labels and uncertainty treatment.
- `CHANGELOG.md`
  - Record the user-visible estimate and labeling improvements.
- `docs/plan/estimated-memory-usage-accuracy.md`
  - Record the implementation state and limitations.

## Tradeoffs

A pre-load estimate cannot include every backend, driver, compute-graph, or system-wide allocation. llama.cpp's own load-time buffer reports are the validation reference, not a promise that a pre-load estimate will equal process working set. Extending GGUF discovery adds a header-only tensor metadata pass; it must not read tensor data and should be checked for acceptable catalog-discovery cost. Models whose metadata cannot support a defensible estimate should show uncertainty rather than a deceptively precise value.

## Verification

- Add Rust unit coverage for tensor range sizing and layer/non-layer grouping.
- Add Vitest cases for CPU-only, partial GPU offload, KV offload on/off, non-F16 K/V cache types, draft mode, and incomplete metadata.
- Run `cargo test` from `studio/src-tauri` and `npm test` plus `npm run build` from `studio`.
- On the pinned Windows runtime, compare supported-model weight and KV components with llama.cpp's per-backend startup allocation logs for CPU-only and partial-GPU loads. If a supported case materially exceeds a 10% difference, report it as uncertain or correct the calculation before treating it as a numeric estimate.

## Validation notes

- The bundled llama.cpp b11429 runtime was launched with local Laya-BF16 GGUF, both CPU-only and partial CUDA offload. Its verbose log shows output-first offload: 1 GPU layer means output only; 2 means output plus the final repeating layer. The frontend estimator follows this pinned behavior.
- CPU-mapped buffers may retain the entire GGUF mapping even when tensors are also placed in CUDA; estimates deliberately describe tensor placement, not OS working-set RAM.
- Laya is a decision/encoder model without the conventional LLM KV cache used by this estimator. Its startup logs cannot validate numeric KV predictions for supported LLM architectures. The 10% threshold requires a future supported-model comparison; no universal accuracy guarantee is claimed.
