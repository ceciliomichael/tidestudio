# llama.cpp CUDA and prompt-processing performance

User requested immediate diagnosis and repair of unexpectedly slow prompt processing on a capable NVIDIA GPU.

## Diagnosed current state

- Managed Laya worker launches with `--gpu-layers 9999`, so TideStudio requests full offload.
- `llama-bench -ngl 9999` reports `backend CPU`, identical to `-ngl 0`.
- `llama-server --list-devices` reports no devices.
- `runtime/llama.cpp/ggml-cuda.dll`, `cublas64_13.dll`, and `cublasLt64_13.dll` are 133–134 byte Git LFS pointer text files, not PE DLLs. Windows loader returns error 193.
- Laya is a 421M-parameter ModernBERT/encoder decision model. The current server auto-creates four slots, splitting 32K context into 8K per slot. Encoder batching is also using generic defaults rather than a single-request optimized path.

## Planned structure

```text
tidestudio/
  studio/
    scripts/
      prepare-llama-runtime.mjs             # modify: validate required CUDA binaries and detected CUDA device
    src-tauri/src/core/backends/llama_cpp/
      process.rs                             # modify: DECISION single-slot + encoder batch/ubatch launch tuning
  docs/plan/
    llama-cuda-prompt-performance.md         # this plan and benchmark results
  ARCHITECTURE.md                            # modify: runtime validation and decision-worker launch behavior
  AGENTS_LEARNING.md                         # modify: durable CUDA/LFS-pointer diagnostic lesson
```

## File-by-file changes

- `studio/scripts/prepare-llama-runtime.mjs` (modify): reject missing, tiny, non-PE, or Git LFS pointer CUDA runtime files. Reinstall cleanly when validation fails; actual GPU availability is checked when a worker requests positive GPU offload so build/bootstrap remains usable on machines without an active NVIDIA device.
- `studio/src-tauri/src/core/backends/llama_cpp/process.rs` (modify): DECISION models use one server slot and explicit encoder-friendly logical/physical batch sizes derived from configured context and capped at 8192 tokens, while leaving LLM/Embedding behavior unchanged. This matches Laya's effective 8192-token encoder context even when a larger context is saved.
- `ARCHITECTURE.md` / `AGENTS_LEARNING.md` (modify): document the validated CUDA runtime and encoder-specific scheduling.
- Local ignored `studio/runtime/llama.cpp/` (regenerate): delete the broken runtime and restore pinned upstream build `b11429` CUDA x64 assets.

## Verification

- `npm run prepare:llama`, then verify required CUDA files are real PE binaries and `llama-server --list-devices` lists the RTX GPU.
- Compare `llama-bench` CPU vs CUDA prompt processing on Laya at 512 and 2048 tokens.
- Restart the managed Laya worker, confirm its command line and `/slots`, send a representative request, and capture prompt-processing timing plus GPU utilization/VRAM.
- Run Rust formatting/checks/tests, production build, and `git diff --check`.

## Measured result on the user's machine

- GPU: NVIDIA GeForce RTX 3080 Ti Laptop GPU, 16 GB VRAM.
- Broken runtime: `llama-server --list-devices` returned no devices; `llama-bench -ngl 9999` still reported CPU and about 539 tok/s at pp512. User-observed managed prompt processing was about 240 tok/s.
- Repaired runtime: CUDA0 detected correctly. Laya BF16 pp512 measured about 15,292 tok/s, and pp2048 with 2048 ubatch measured about 15,849 tok/s.
- Exact DECISION server tuning with `--parallel 1 --batch-size 8192 --ubatch-size 8192` processed a 7,183-token `/v1/systemone` request successfully in about 2.44 s, with one slot and roughly 5 GB total GPU memory in use. The old generic server configuration used four slots and 512 ubatch and could not process the same 7,183-token encoder request.
- User independently confirmed prompt processing is now fast after the runtime repair.
- Final validation passed: `cargo fmt --all --check`, `cargo check --offline --quiet`, `npm run prepare:llama` (runtime recognized as healthy without redownload), `npm run build`, and `git diff --check`. The existing Vite bundle-size warning remains non-blocking.
