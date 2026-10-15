# Hybrid GGUF Memory Estimates

## Goal

Fix `N/A` for installed supported Qwen3.5, LFM2 and LFM2.5 GGUFs while preserving the original compact **GPU / Total** Beta card. Estimates are weights and cache, not process RAM or full VRAM allocation.

## Files and responsibilities

```text
studio/src-tauri/src/core/models/
  gguf.rs             Capture architecture-specific metadata and classify cache layers
  memory_profile.rs   Store tensor footprints, tied embeddings and per-layer state
studio/src/lib/tauri.ts         Serialize typed memory profiles
studio/src/features/models/
  modelMemory.ts                Calculate offload, cache and recurrent state
  modelMemory.test.ts           Regression tests
docs/plan/model-memory-estimates.md
ARCHITECTURE.md
DESIGN.md
CHANGELOG.md
```

Qwen3.5 identifies attention blocks with `full_attention_interval`; remaining blocks use f32 recurrent state and convolution history from GGUF SSM dimensions. Normal inference excludes the final `nextn_predict_layers` block but retains its slot in GPU-offload numbering. Tied output embeddings can require an additional GPU copy.

LFM2 and LFM2.5 provide a per-block `attention.head_count_kv` array. Non-attention blocks retain short-convolution history from `shortconv.l_cache`. Both CPU and GPU cache estimates respond to context, layer offload and cache-offload selection. Missing layout metadata remains `N/A` instead of a guessed zero. The frontend continues to show only GPU and Total.

## Runtime comparison

Bundled llama.cpp b11429, Qwen3.5-0.8B-BF16, 512 context, four GPU layers, one sequence: KV 6.00 MiB (CPU 5.00, GPU 1.00); recurrent state 19.27 MiB (CPU 18.20, GPU 1.07). The inactive 25th MTP block was ignored during normal load. These logs support cache formulas but do not establish a whole-process error bound.

LFM2 d1-3B-BF16, 256 context, four GPU layers: KV 4.00 MiB (CPU 3.50, GPU 0.50); recurrent state 0.34 MiB (CPU 0.31, GPU 0.03). This decision variant subsequently failed runtime initialization because its subtype is unsupported, so this validates its cache calculation, not inference support.

## Validation

Run `cargo test` under `studio/src-tauri`, and `npm test`, `npm run build`, and `npm run release:windows` under `studio`. Optionally set `TIDESTUDIO_MEMORY_FIXTURES=D:\tidestudio\models` for the Rust fixture test against installed GGUF metadata. This inspection reads headers and tensor descriptors only, never model tensor payloads.

The card excludes output/compute/driver buffers, backend transformations, actual CPU memory-mapping residency and draft-model KV. Runtime device fallback can affect placement. Estimates should not be represented as full RAM/VRAM utilization.
