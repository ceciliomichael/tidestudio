# Model Capability Settings Matrix

## Intended result

The Models and Server inspectors must show only settings that apply to the selected model's execution mode and detected capabilities. Unsupported controls are hidden rather than disabled or silently passed to llama.cpp.

## Capability matrix

### LLM

- Load: context length, GPU offload, flash attention, prompt-template override, advanced llama.cpp arguments.
- Speculative decoding is target-model configuration.
  - MTP is offered only when GGUF/repository evidence marks the target as MTP-capable.
  - External draft mode remains available because compatibility is determined by the selected target/draft pair.
- Inference: system prompt and token-sampling defaults.
- Reasoning controls are individually gated by detected template/model support for thinking toggles, effort levels, budget, and preserved reasoning.

### Embedding

- Load: context length, GPU offload, flash attention, embedding pooling, advanced llama.cpp arguments.
- llama.cpp embedding mode is added automatically by the backend.
- Prompt template, speculative decoding, and chat-generation Inference settings are hidden.
- GGUF pooling metadata is surfaced when available.
- Rank pooling is treated as reranking rather than ordinary embeddings; TideStudio blocks the misleading public load path until a public reranking endpoint exists.

### Drafter

- A drafter is a speculative companion, not a standalone target model in the current product flow.
- Draft path, draft GPU layers, and draft token limits are configured from the target LLM's Speculative Decoding section.
- Standalone Load and Inference controls are not shown.

### DECISION

- Load: generic runtime controls such as context length, GPU offload, flash attention, and advanced llama.cpp arguments.
- Prompt template and speculative decoding are hidden.
- Chat-generation Inference controls are hidden.
- Requests use the native System One/Decisions flow; generation sampling and reasoning defaults are not applied.

## Runtime behavior

- Load settings become llama-server process arguments and apply on the next worker load.
- Inference settings are gateway-side request defaults and are not repeated as llama-server sampling/reasoning launch flags.
- Explicit request fields override TideStudio defaults.
- Per-request reasoning budget uses llama-server's request field rather than a global worker launch budget.

## Detection

- Continue using category plus evidence-based GGUF/repository capability detection.
- Read GGUF pooling metadata where available.
- Detect independent reasoning sub-capabilities rather than assuming every reasoning model supports toggling, effort levels, and preserved reasoning.

## Verification

- TypeScript production build.
- Rust formatting and unit tests, including pooling metadata coverage.
- Go API gateway tests and vet.
- git diff --check.
