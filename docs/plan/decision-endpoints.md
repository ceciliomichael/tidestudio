# Decision endpoint compatibility

## Goal

Add truthful decision-API support without fabricating probabilities:

- MTP-capable GGUFs default to MTP speculative mode when no saved per-model sidecar overrides it.
- Expose llama.cpp's native TypeSafe-compatible `POST /v1/systemone` through TideStudio.
- Add OpenAI-compatible `POST /v1/decisions` by translating OpenAI predicate/choice/score requests to llama.cpp System One and translating the real System One probabilities back.
- Expand endpoint verification/tests and surface the new routes in Supported Endpoints.

## Constraints

- Decision endpoints require a native decision model. A normal text-generation GGUF should return the worker's 501 instead of falling back to generated prose.
- Do not synthesize probabilities with chat output.
- OpenAI per-request values and model identity remain explicit.
- Existing OpenAI chat/responses/completions and Anthropic messages routes remain pass-through.
- Embeddings remain model/launch-mode dependent and must not be presented as universally available.

## Implementation

- Frontend model defaults:
  - `createModelConfig(model)` defaults `speculativeMode` to `mtp` when `supportsMtp` is true.
  - Persisted sidecar settings continue to override the default.
- API gateway:
  - route `/v1/systemone` directly to the selected worker.
  - add `decisions.go` adapter for OpenAI Decisions.
  - predicate -> Jev `noul`
  - choice -> Jev `choice`
  - score -> Jev `score`
  - translate System One response probabilities/confidence into OpenAI Decisions response shape.
  - preserve explicit model routing and request cancellation.
- Endpoint UI:
  - add `/v1/decisions` to OpenAI-compatible.
  - add TypeSafe-compatible family with `/v1/systemone`.
  - add Anthropic `/v1/messages/count_tokens`.
- Model library:
  - classify GGUFs with decision metadata as `DECISION`.
  - default detected embedding models to `--embeddings`.
- Verification:
  - gateway unit/integration tests for decision translation.
  - actual bundled llama.cpp smoke test for existing OpenAI/Anthropic routes.
  - actual bundled worker test confirming System One exists and rejects a non-decision model with 501.

## Verification commands

- `go test ./...`
- `go vet ./...`
- `cargo test`
- `cargo fmt --check`
- `npm run build`
- `git diff --check`

## Verified

- Real Qwen text worker through TideStudio gateway:
  - `GET /v1/models`: 200
  - `POST /v1/chat/completions`: 200
  - `POST /v1/responses`: 200
  - `POST /v1/completions`: 200
  - `POST /v1/messages`: 200
  - `POST /v1/messages/count_tokens`: 200
- Real embeddings-mode worker with pooling enabled:
  - `POST /v1/embeddings`: 200
- Real Julia-1 decision GGUF:
  - llama.cpp reports `output_modalities: [decisions]`
  - direct `POST /v1/systemone`: 200
  - TideStudio `POST /v1/systemone`: 200
  - TideStudio `POST /v1/decisions`: 200 with real predicate/choice/score probabilities
- A normal text GGUF returns llama.cpp 501 for `/v1/systemone`, confirming TideStudio does not fake decision outputs.
