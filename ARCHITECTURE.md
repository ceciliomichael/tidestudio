# Architecture

## Model memory estimation

The GGUF scanner records compact per-layer weight footprints and, for Qwen3.5/LFM2/LFM2.5, hybrid KV and recurrent-state allocation metadata. Qwen3.5's ordinary load ignores the final MTP predictor block while retaining that block's position in GPU-offload numbering; output offload may copy tied token embeddings to GPU. LFM2 families derive attention blocks from per-layer KV head counts and non-attention blocks from short-convolution cache dimensions. The pre-load estimator combines these with context, cache types and selected offload. The compact GPU / Total values are weight-plus-cache estimates, not process-memory measurements or full device utilization. Unsupported metadata remains unknown.

## Renderer and native appearance

`studio/src/styles/global.css` owns TideStudio's semantic light/dark palette and feature-level styling. React shared controls in `studio/src/components/ui/` use those CSS roles; the `--button-primary-*` names are compatibility aliases to the same `--color-action*` tokens, not a separate palette. Neutral panels and green selection/action fills have different semantic purposes; green accent borders are transparent in dark appearance except for the one visible runtime split divider.

`studio/src/lib/appearance.ts` remains the owner of the persisted Light/Dark/System setting in SQLite via `app.appearance.v1`. It resolves OS changes, sets `document.documentElement.dataset.theme`, synchronizes HTML theme metadata and native Tauri window theme/sidebar caption, and emits the resolved mode over `tidestudio:appearance`. The separate tray WebView reads the existing preference and listens for the same event, using its own `studio/src/tray/menu.css` palette. The Windows DWM caption text color is mirrored in `studio/src-tauri/src/commands/window.rs`; no second appearance preference store is introduced.

## Windows tray popup

`studio/src-tauri/src/tray.rs` owns the preloaded transparent tray WebView, outside-click polling and tray-local managed dismissal state. Right-button down closes an open popup, and focus loss also closes immediately over the tray instead of waiting for mouse-up. The matching right-button up consumes the pending dismissal rather than reopening; a subsequent deliberate press opens normally. Empty tray rectangles use only the padded opening click, not a rectangle extending from the desktop origin. Visibility still uses the existing `tray-popup-visibility` event and CSS opacity; no native hide/show animation or menu styling change is introduced. Source-level tests cover event ordering and hit areas, not live Windows visual timing.

## Current implementation

TideStudio is a Rust + Tauri desktop application under `studio/`.

The application is split into three primary boundaries:

1. **Rust Core** in `studio/src-tauri/src/core/`
   - `backends/`: inference backend abstraction and concrete backend implementations.
   - `models/`: local GGUF discovery and model metadata.
   - `config/`: typed server launch configuration.
   - `servers/`: active server registry, status, and captured logs.
2. **Tauri IPC** in `studio/src-tauri/src/commands/`
   - Thin commands expose core behavior to the frontend.
3. **API gateway** in `studio/api-gateway/`
   - One public HTTP listener routes OpenAI-compatible and Anthropic-compatible requests to private llama.cpp workers by model ID.
   - Maintains a concurrency-safe in-memory worker registry and an authenticated, loopback-only management API.
   - Handles public API authentication, CORS, model listing, and streaming proxying.
4. **Frontend** in `studio/src/`
   - React + TypeScript features for navigation, model selection, server settings, status, and logs.
   - Shared presentation primitives in `components/ui/` provide reusable buttons, fields, switches, status treatments, and section headers.
   - Server and Models are separate application destinations. Server owns runtime lifecycle and logs; Models owns model selection and per-model launch configuration.

Runtime binaries are separate from backend abstractions. llama.cpp binaries live at `studio/runtime/llama.cpp/`, while `LlamaCppBackend` defines how TideStudio controls them.

Workspace-managed GGUF files default to the user's `%USERPROFILE%\\.tidestudio\\models` directory on Windows. The effective models root is process-wide and initialized before frontend model discovery; a custom root may be selected from Settings > Configuration and is persisted in SQLite.

## Optional inference runtimes

Model workers select an inference engine from GGUF compatibility, then prefer the engine-specific runtime chosen in Settings > Runtimes. Separate llama.cpp and PrismML preferences use versioned SQLite `ui_preferences` keys. Defaults are `auto`; preferences are restored synchronously before the JIT controller starts. Selecting a runtime requires the variant to be installed with a usable CPU or detected GPU device. Changes take effect on new loads only; existing workers retain their running binary. An unavailable or incompatible preference falls back to a compatible runtime and records a reason on the server status for display on the loaded model card. Model load dialogs and inspectors have no per-model runtime override; legacy `runtimeId` values cannot override these engine preferences.

Completed GGUF downloads are persisted in the existing application SQLite database in a dedicated `completed_downloads` table. The schema stores the download ID, repository, file name, measured sizes, and completion time. Startup restores only completed entries. Repeated completion notifications use an upsert, and Clear Completed deletes the records, without restoring active or stopped transfers.

Runtime installation streams stage-specific progress to the frontend: preparing, downloading, verifying, extracting, and installing. For multi-archive runtimes, a bounded HEAD preflight gathers archive sizes; when all are known, cumulative downloaded bytes provide a non-resetting overall percentage. Otherwise, the UI identifies the current package and reports its measured file progress without inventing a total. GPU discovery has a four-second timeout and a short retry cache on failure; binary device enumeration also has a timeout.

The Windows application retains the bundled llama.cpp CUDA runtime. Settings > Runtimes additionally installs Windows x64 CPU, Vulkan, ROCm, and PrismML variants on demand under the user's .tidestudio/runtimes directory. Separate versioned runtime directories never enter the NSIS installer. The Rust runtime catalog pins the upstream b11429 archive hashes and PrismML fork tag. PrismML archives require GitHub's published SHA-256 release asset digests.

Downloads are streamed, hash-checked and extracted through temporary directories before an atomic rename. Cancellation or failure removes partial files. Windows video-controller discovery and each GPU runtime's device listing guide per-model selection. Manual loading and JIT both use automatic runtime selection regardless of legacy saved runtime IDs. Bonsai filenames, metadata names and specialized quantizations select PrismML. An installed runtime cannot be removed while any active worker uses it.

All runtimes reuse the existing private llama-server worker ports and Go API gateway. A missing optional runtime causes an explicit Settings > Runtimes installation error instead of a silent background download. The bundled CUDA binary can run on CPU with GPU offload disabled, preserving a basic offline fallback on non-NVIDIA machines. MLX and Metal are not supported on Windows.

## Windows release packaging

The Windows x64 NSIS build queries published upstream llama.cpp releases for the newest complete Windows x64 CUDA 13.4 build, validates the downloaded server and DLLs in a temporary directory, and replaces the bundled runtime only after validation succeeds. It reuses an already-matching runtime; API/download or validation failures stop packaging. Development startup retains its pinned b11429 bootstrap. The build also compiles the Go API gateway, then stages the llama server, its DLL dependencies, and the gateway into `studio/src-tauri/release-runtime/`. Tauri bundles that directory as `runtime/` beside the installed executable. Build with `npm run release:windows` from `studio/`. Generated files under `release-runtime/` are not committed.

The NSIS preinstall/preuninstall hook in `studio/src-tauri/nsis/close-running-app.nsh` checks the installed executable with Windows Restart Manager. If TideStudio is running, it sends `--quit-for-install` through the single-instance IPC channel to invoke the app's normal worker/gateway shutdown, then waits for the process to exit before files are changed. Windows Restart Manager handles versions that do not support the shutdown argument.

The icon source of truth is `studio/src-tauri/icons/source.svg`, with native icon files generated by `tauri icon`. The frontend also uses the generated application icon in `index.html`; there is no separate `public/` favicon.

Development builds continue to use `studio/runtime/` for generated inference binaries. Development and installed Windows builds both manage GGUF files under `%USERPROFILE%\\.tidestudio\\models` by default, outside the repository and read-only installation directory. Settings > Configuration may override the models root; the custom path is stored in the existing SQLite UI-preferences database and initialized during Tauri setup before any model operations.

## Backend abstraction

`InferenceBackend` is the boundary between the server registry and a concrete inference engine.

```text
ServerRegistry
    |
InferenceBackend
    |
LlamaCppBackend
    |
runtime/llama.cpp/llama-server.exe
```

`InferenceBackend` starts a backend-neutral `ManagedInference` instance. The managed instance exposes process identity, running state, stop behavior, and logs without leaking llama.cpp-specific process types into the registry.

The current implementation only provides `LlamaCppBackend`. Additional backends should only be added when they become real product requirements.

## Data flow

```text
React UI
  -> Tauri command
    -> ServerRegistry
      -> InferenceBackend
        -> LlamaCppBackend
          -> llama-server child process
    <- typed status/log data
  <- Tauri IPC
```

## Runtime lifecycle

Starting a server:

1. The registry checks whether the requested port is already managed.
2. The registry delegates startup to its configured `InferenceBackend`.
3. `LlamaCppBackend` resolves `studio/runtime/llama.cpp/llama-server.exe`.
4. The backend validates the model path and translates typed configuration into command-line arguments.
5. The backend starts the process and returns a backend-neutral managed instance.
6. The registry stores the instance by port.

Stopping, status, and log retrieval operate through `ManagedInference` rather than llama.cpp-specific types.

The registry also exposes a list operation so the frontend can render every TideStudio-managed server. Each server status includes its backend, model path, port, PID, and running state.

## Frontend layout

The desktop workspace is a resizable three-panel layout:

- left: product navigation
- center: active page content
- right: contextual inspector for the active page

The initial proportion is approximately 20/60/20. The left and right separators are draggable and enforce minimum usable widths.

On Server, the center panel is a vertical runtime workspace. The top region contains the server toolbar, real loaded-model cards, and supported endpoints. The bottom region is a collapsible, vertically resizable API Logs dock driven by the selected running model. Loaded models are real TideStudio-managed llama-server processes only.

The Server right inspector reuses the Models `ModelInspector` for the selected loaded model. Server-wide configuration is intentionally separated from model configuration and is opened from the Server Settings toolbar action.

The Server workspace surfaces the public API gateway endpoint. Supported Endpoints presents OpenAI-compatible, Anthropic-compatible, and TypeSafe-compatible inference families; gateway health/control behavior is not presented as a user-facing API family. Server Settings owns the gateway's network binding, public port, API key, CORS, MCP/JIT policy, and persists as one JSON value in TideStudio's SQLite preferences store. The default public port is 3456. Each llama.cpp worker binds only to a private loopback port, and Rust chooses its port and launches it with a stable `--alias` and `--no-webui`.

The Models inspector is split into three presentation tabs: Info, Load, and Inference. Info renders catalog metadata; Load edits supported launch/runtime fields; Inference edits supported generation fields. The tab structure is frontend-only and does not change the backend configuration schema.

Server > Load Model is a two-page dialog: the catalog first lists installed GGUFs with an in-place Stop action for active workers, then selecting an unloaded model opens a pre-load settings page. The page reads the existing per-GGUF configuration, keeps changes in a local draft until Load Model is confirmed, and then persists the complete sidecar before starting the worker. It exposes supported context/GPU/CPU, batching/parallelism, KV offload, RoPE, flash-attention and model-specific options. No separate remember/advanced toggles are needed. GGUF discovery captures the architecture block count, attention dimensions, and a compact per-layer/on-disk tensor footprint computed from tensor-info offsets without reading tensor payloads. The original compact Beta memory card retains only GPU and Total values, both derived from tensor placement and supported homogeneous-attention KV estimates using the current context and offload settings. Total represents model-plus-KV bytes, not process RAM or GPU telemetry; output/compute/driver allocations, draft KV and backend-specific tensor transformations are excluded. Unknown metadata or unsupported architectures produce unavailable estimates, and runtime CPU fallback may invalidate GPU placement assumptions. The new load fields map to llama.cpp startup flags and are also consumed by the JIT sidecar loader; decision workers retain their fixed single slot and configurable encoder batch sizes.

Models and Server use the same real local model source. Rust recursively discovers GGUF files under the managed models directory and enriches them from GGUF header metadata. Because that metadata pass can take noticeable time across several large model files, React restores the last completed local catalog and resolved per-model load configs from the existing SQLite UI-preferences store during startup, then replaces that cache with the authoritative discovery result in the background. This keeps Server > Load Model usable immediately without moving filesystem inspection onto the UI thread. Discovery also derives a stable tokenizer fingerprint from complete `tokenizer.ggml.*` metadata when both the tokenizer model and ordered token vocabulary are present. Speculative draft selectors only offer installed LLM/Drafter GGUFs whose tokenizer fingerprints exactly match the target, so uncertain candidates are excluded rather than guessed from names. Missing metadata is surfaced as unknown rather than replaced with demo values.

Model deletion removes the entire containing folder for a managed GGUF stored below the models root. This also removes sibling GGUFs, vision projector files, and per-model sidecars. Rust rejects paths outside managed storage and refuses deletion while any model from that folder is running. A GGUF directly in the configured models root is deleted individually with its settings sidecar; the root itself and unrelated files are never recursively deleted. React clears removed models' local config state and refreshes the catalog after successful deletion.

Runtime workers, public API requests, and JIT refer to managed GGUFs by their filename stem (without `.gguf`), not a repository-relative path. JIT advertises only uniquely named installed GGUFs, and ID lookup fails for ambiguous filenames. The server refuses to reuse a running model's API ID for a different GGUF; users must rename conflicting GGUFs to load both distinctly.

Model Search is a real multi-provider GGUF workspace. The React center panel selects a repository source and searches public GGUF repositories while the right inspector loads the selected repository's GGUF files. Hugging Face is the default source and ModelScope is the second source. Rust owns provider HTTP access and streamed downloads so browser/CORS restrictions do not leak into the frontend. Hugging Face downloads remain under `<models-root>/<publisher>/<repo>/`; ModelScope downloads use `<models-root>/modelscope/<publisher>/<repo>/` to prevent provider collisions. Both use a temporary `.part` file before final rename. The shared right inspector renders repository README/model-card content as Markdown for both providers.

The Rust download service registers each in-flight provider/repository/file transfer with an independent abort handle. A Stop command aborts only that transfer, releases its HTTP stream, and removes its `.part` file before emitting a Stopped event. A finished transfer is removed from the cancellation registry before GGUF inspection, so completed model files are preserved. React shows Downloading and Stopping while a transfer is active, removes cancelled transfers from activity after the Stopped event or cancellation result, and retains Completed entries until cleared. Restarting a cancelled transfer starts a fresh download; stale Stopped events do not clear a new attempt.

After a GGUF download, TideStudio parses only the GGUF header, metadata, and tensor-info section, not tensor data. The inspector derives architecture, embedded chat template, model type, parameter display, context length, pooling type, decision-model markers, MTP/drafter, reasoning, vision, and tool-calling signals from GGUF metadata plus repository metadata and naming conventions. Decision GGUFs are classified as `DECISION`, including models carrying `modern-bert.decision.*` or `decision-model` metadata. Reasoning detection is granular: general reasoning support, `enable_thinking`, reasoning-effort support, and reasoning preservation are tracked independently. MoE parameter labels preserve `general.size_label` when present and can otherwise derive expert layouts from expert-count metadata plus expert tensor dimensions. Capability results are evidence-based with confidence levels because reasoning/tool support is not represented by one universal GGUF flag.

The public API layer is implemented by TideStudio's Go-based API gateway under `studio/api-gateway/`, launched and monitored by Rust/Tauri. It provides one public API port for all loaded models and proxies the OpenAI-compatible chat/responses/completions/embeddings routes, Anthropic messages/token-counting routes, and TypeSafe System One requests to their respective llama.cpp worker processes. `/v1/decisions` is adapted to llama.cpp's native System One decision API so returned probabilities come from a real decision model rather than generated text. Rust/Tauri remains the lifecycle owner for both workers and the gateway, but the lifecycles are independent: workers may load, become ready, update defaults, and stop while the gateway is unavailable or still starting. Gateway registration is eventual and all ready workers are reconciled whenever the gateway becomes available or is reconfigured.

JIT loading is coordinated by the Go gateway (`httpapi/jit.go`) and Rust's background lifecycle controller (`commands/jit.rs`). Rust periodically syncs the installed GGUF catalog and polls authenticated loopback control actions to start/stop workers using the existing registry. The loader applies saved GGUF sidecar settings, while the gateway coalesces concurrent requests for the same unloaded model. Requests reserve their worker through the entire proxied response, including streaming. Idle expiry is measured from the final release and unloads only JIT-origin workers. The optional single-JIT policy unloads the previous idle JIT worker before starting another. Manually loaded workers are never automatically unloaded. Policies persist in the existing SQLite Server Settings and are passed to the Go process at startup; the gateway keeps only transient scheduling state.

Gateway startup on Windows passes the owning TideStudio process ID to the Go listener. The gateway holds a Windows process handle and shuts down its HTTP listener if the parent exits unexpectedly, preventing an orphan from occupying the public port after an app restart. Rust separately tracks the child it launched and checks the configured port before spawn, reporting a specific port-conflict error rather than adopting any unrelated or stale HTTP server. Health and displayed status refer to the gateway managed by the current app instance; the public port stays configurable (default 3456).

The llama.cpp runtime itself is not stored in Git. TideStudio pins upstream llama.cpp release `b11429` for the Windows x64 CUDA runtime and prepares `studio/runtime/llama.cpp` on demand through `npm run prepare:llama`. Tauri dev/build hooks run that preparation step before starting so fresh clones remain reproducible without committing hundreds of megabytes of generated runtime binaries.

The runtime bootstrap validates more than the llama.cpp version: required CUDA DLLs must be real PE binaries rather than Git LFS pointer text. A requested positive GPU-offload count is fail-fast at worker launch if `llama-server --list-devices` does not expose an NVIDIA CUDA device, rather than silently running the model on CPU. Decision/encoder workers use one server slot and a physical/logical prompt batch up to 8192 tokens so the full effective Laya encoder context can be processed in one batch instead of generic four-slot scheduling and 512-token micro-batches.

Each managed GGUF can have a sibling `<model>.gguf.tidestudio.json` settings file. The versioned file separates worker-load settings from request-time inference defaults and is read/written through Rust so configuration stays with the exact GGUF/quantization. Loaded workers retain their current inference defaults in the Rust registry; the API gateway receives those defaults at registration and on live edits. Before proxying a request, the gateway fills only missing request fields, so explicit client parameters always win. System prompt, sampling defaults, and supported thinking/reasoning controls therefore change for subsequent requests without restarting the worker, while context/offload/flash-attention/speculative/template/CLI launch settings remain next-load settings.

Model worker startup is non-blocking from the desktop UI. Rust spawns the llama.cpp process, records it in the server registry with lifecycle `loading`, and returns control to React immediately. The readiness loop runs separately and only takes the registry mutex for short process-state checks; it never holds that mutex while waiting for the model to load. Once the worker answers with the expected alias, Rust marks it `ready` and emits a status event immediately, independent of gateway state. Gateway registration then runs separately and is best-effort; background gateway startup or a later Server Settings apply reconciles every ready worker. Gateway process startup follows the same rule: the gateway mutex is held only to spawn/check process state, never across the HTTP health-wait loop, and status checks run off the Tauri UI command thread. Failed worker startup is cleaned up and emitted as an asynchronous failure event. RAM status refreshes only the managed worker PID rather than scanning all system processes.

Model settings and server settings are separate concerns. Per-model settings are capability-gated by execution mode instead of exposing one generic form. LLMs own chat templates, sampling defaults, and target-side speculative decoding; MTP is offered only when the target is detected as MTP-capable, while external draft mode is configured from the target LLM. Embedding models automatically launch in llama.cpp embedding mode and expose pooling rather than chat-generation controls. Drafter models are treated as speculative companions configured from a target LLM. Decision models expose only generic runtime/load controls because typed System One inference does not use chat sampling or reasoning defaults. Server configuration owns host/port and lifecycle. React restores each model's JSON sidecar into the shared model inspector and sends the applicable settings to Tauri when a worker starts or when live inference defaults change.

Small persistent UI preferences are stored in SQLite under the TideStudio app-data directory. A generic `ui_preferences` key/value table is accessed through Tauri commands so React components do not own database logic directly. Model discovery, model-sidecar reads/writes, and SQLite preference access run on blocking workers behind asynchronous Tauri commands to keep filesystem and database operations off the desktop event loop during startup. The Go gateway starts in the background from restored Server settings; Model Search cache and remote results are initialized only when its page is first opened.

The llama.cpp backend maps speculative modes to the bundled runtime's supported flags only for LLM targets: MTP uses `--spec-type draft-mtp`; external draft models use `--spec-type draft-simple` plus `--spec-draft-model`. Draft token limits, minimum probability, and draft GPU layers use their corresponding `--spec-draft-*` flags. Embedding workers receive `--embeddings` automatically and optionally a supported pooling override.

Model inference defaults distinguish request-time and launch-time settings. System prompt, sampling defaults, and only the reasoning/thinking controls supported by the selected LLM are registered with the API gateway as request-time defaults so loaded models can change them for subsequent requests without restarting. They are not duplicated as llama-server sampling/reasoning launch flags. Prompt template, context/offload, flash attention, embedding mode/pooling, speculative decoding, and raw llama.cpp arguments remain launch-time settings. Explicit request values continue to win over TideStudio defaults.

The presentation layer is currently light-mode only. Shared UI primitives carry the common visual system so feature components focus on product state and behavior rather than duplicating control markup and styling.

## Intended direction

- Add Hugging Face cache discovery to the existing model discovery boundary.
- Parse useful GGUF metadata for richer model-library information.
- Add a dedicated model download page behind the left navigation.
- Add persistent launch presets when the settings workflow requires them.
