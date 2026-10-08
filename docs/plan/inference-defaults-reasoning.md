# Inference Defaults and Reasoning Controls Plan

## Goal

Expand the Models > Inference inspector with LM-Studio-style prompt, reasoning, and sampling defaults while using only settings supported by the bundled llama.cpp runtime.

## Verified runtime support

The bundled `llama-server` supports:

- `--chat-template`
- `--reasoning on|off|auto`
- `--reasoning-effort`
- `--reasoning-budget`
- `--reasoning-preserve` / `--no-reasoning-preserve`
- `--seed`
- `--temp`
- `--top-k`
- `--top-p`
- `--min-p`
- `--typical-p`
- `--repeat-penalty`
- `--presence-penalty`
- `--frequency-penalty`

The runtime does not expose a global system-prompt startup flag. System prompt is therefore stored as a TideStudio per-model request default and is not sent to `llama-server` during launch.

## Inference inspector

```text
Inference
├── Prompt
│   ├── System Prompt
│   └── Prompt Template
├── Reasoning
│   ├── Enable Thinking
│   ├── Reasoning Effort
│   ├── Reasoning Budget
│   └── Preserve Reasoning
└── Sampling
    ├── Temperature
    ├── Top K
    ├── Top P
    ├── Min P
    ├── Typical P
    ├── Seed
    ├── Repeat Penalty
    ├── Presence Penalty
    └── Frequency Penalty
```

Reasoning controls are shown only when the selected catalog model is marked as reasoning-capable.

## Planned structure

```text
studio/src/
├── components/ui/
│   └── TextAreaField.tsx
├── features/models/
│   ├── ModelInferenceTab.tsx
│   ├── ModelInspector.tsx
│   ├── mockModels.ts
│   └── types.ts
├── lib/
│   ├── config.ts
│   └── tauri.ts
└── styles/global.css

studio/src-tauri/src/core/
├── config/server_config.rs
└── backends/llama_cpp/process.rs

ARCHITECTURE.md
DESIGN.md
AGENTS_LEARNING.md
docs/plan/inference-defaults-reasoning.md
```

## File changes

### Create

- `studio/src/components/ui/TextAreaField.tsx`
  - Reusable multiline field matching `InputField`.
- `docs/plan/inference-defaults-reasoning.md`
  - Plan and verification record.

### Modify

- `studio/src/lib/config.ts`
  - Add prompt, reasoning, and sampling model defaults.
- `studio/src/lib/tauri.ts`
  - Keep system prompt out of the server launch payload type.
- `studio/src/features/models/types.ts`
  - Add mock capability metadata for reasoning support.
- `studio/src/features/models/mockModels.ts`
  - Mark reasoning-capable mock LLMs.
- `studio/src/features/models/ModelInspector.tsx`
  - Pass selected model capability metadata to Inference.
- `studio/src/features/models/ModelInferenceTab.tsx`
  - Add Prompt, Reasoning, and Sampling sections.
- `studio/src/app/App.tsx`
  - Exclude request-only system prompt when constructing `ServerConfig`.
- `studio/src-tauri/src/core/config/server_config.rs`
  - Add supported prompt-template, reasoning, and sampling launch fields.
- `studio/src-tauri/src/core/backends/llama_cpp/process.rs`
  - Translate supported fields to verified llama.cpp flags.
- `studio/src/styles/global.css`
  - Style reusable textarea and inference helpers.
- `ARCHITECTURE.md`
  - Document request-only vs launch-time inference defaults.
- `DESIGN.md`
  - Document Inference section hierarchy.
- `AGENTS_LEARNING.md`
  - Record the model inference configuration direction.

### Delete

- None.

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo check`.
3. Run `npm run build`.
4. Confirm system prompt is not serialized into `ServerConfig`.
5. Confirm reasoning controls render conditionally from model capability.
6. Confirm supported reasoning fields map to exact llama.cpp flags.
7. Confirm all sampling controls map to exact llama.cpp flags.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo check` passes.
- `npm run build` passes.
- System prompt remains frontend request-default state and is omitted from Rust `ServerConfig`.
- Reasoning controls render only for models marked `supportsReasoning`.
- Prompt template maps to `--chat-template`.
- Thinking maps to `--reasoning on|off`.
- Reasoning effort, budget, and preservation map to the verified reasoning flags.
- Temperature, top-k, top-p, min-p, typical-p, seed, repeat penalty, presence penalty, and frequency penalty map to their verified llama.cpp flags.
