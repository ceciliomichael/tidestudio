# Embedded Chat Template Prefill Plan

## Goal

Surface the real GGUF embedded chat template in Models > Load while preserving llama.cpp's model-default behavior.

## Behavior

- GGUF discovery exposes the parsed `tokenizer.chat_template`.
- Real catalog models carry that embedded template.
- A newly discovered model's `ModelConfig.chatTemplate` is initialized from the embedded template.
- Load > Prompt Template therefore shows the actual model template instead of an empty field.
- If the field remains identical to the embedded template, TideStudio sends no `--chat-template` override and lets llama.cpp use the GGUF default.
- If the user edits the field, TideStudio passes the edited value as `--chat-template`.
- Clearing the field also falls back to the GGUF default.

## Files

Modify:
- `studio/src-tauri/src/core/models/types.rs`
- `studio/src-tauri/src/core/models/discovery.rs`
- `studio/src/lib/tauri.ts`
- `studio/src/features/models/types.ts`
- `studio/src/features/models/ModelLoadTab.tsx`
- `studio/src/app/App.tsx`
- `DESIGN.md`
- `AGENTS_LEARNING.md`
- `docs/plan/embedded-chat-template-prefill.md`

## Verification

1. Run `cargo fmt --all`.
2. Run `cargo test`.
3. Run `cargo check`.
4. Run `npm run build`.
5. Confirm ModelInfo exposes `chatTemplate`.
6. Confirm new model configs prefill from embedded GGUF metadata.
7. Confirm unchanged embedded templates are not sent as overrides.

## Status

Implemented and verified.

- `cargo fmt --all` passes.
- `cargo test` passes.
- `cargo check` passes.
- `npm run build` passes.
- Real ModelInfo exposes the embedded GGUF chat template.
- New per-model configs prefill `chatTemplate` from GGUF metadata.
- Load > Prompt Template shows the embedded template when present.
- An unchanged embedded template is converted back to an empty launch override so llama.cpp uses the GGUF default.
- Edited templates continue to pass through as explicit `--chat-template` overrides.
