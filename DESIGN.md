# Design

## Visual taste

Create interfaces that feel calm, precise, and quietly polished. Favor clarity over spectacle. Character should come from proportion, typography, spacing, alignment, and small purposeful details rather than decoration.

### Current theme

- TideStudio is light-mode only for now. Do not add a dark theme, theme selector, or dark-theme variables until explicitly requested.
- The current visual tokens and spacing are intentionally aligned with the local TideCode light design system.
- Use Google Sans Flex for interface typography.
- Use a warm near-white shell, soft gray sidebar/inspector surfaces, white primary surfaces, and the TideCode green accent family.
- Prefer compact 6-10px control radii, fine neutral borders, and restrained low-opacity shadows. Reserve larger radii for genuinely elevated surfaces such as dialogs and popovers.

### Overall feel

- Keep surfaces mostly flat and solid. Use depth only when it clarifies layers or interaction.
- Let primary content lead. Supporting elements should remain easy to find without competing for attention.
- Give layouts room to breathe without creating weak or empty structure.
- Keep the system consistent without making every section look identical.

### Structure and hierarchy

- Group related elements through proximity, alignment, and subtle separation.
- Prefer open layouts, dividers, and shared surfaces over wrapping every section in a card.
- Use cards only when something is a genuinely distinct object or needs an interaction boundary.
- Establish order of attention through size, placement, contrast, and typography before decoration.

### Surfaces and depth

- Prefer solid fills and fine borders over gradients, blur, glossy effects, or glass treatments.
- Keep corner radii and border treatments consistent.
- Use soft, low-contrast shadows only when they clarify elevation or movement.
- Avoid heavy shadows, thick outlines, and decorative boxes.

### Color and type

- Use a small coherent palette with one clear accent.
- Add color when it communicates state or meaning.
- Keep secondary text quieter but still readable.
- Use a restrained typographic hierarchy.
- Use a comfortable desktop scale. Most readable UI text should sit around 12-14px, primary headings around 16-18px, standard controls around 38-40px tall, compact controls around 34px, navigation rows around 38-40px, and primary model/server rows around 70-88px.
- Use monospace selectively for technical values, ports, paths, logs, or metadata.
- Use `lucide-react` for interface icons. Do not use emoji as icons.
- Pair icons with text when meaning is not obvious.

### Detail and interaction

- Use subtle changes in color, border, elevation, or movement for responsive controls.
- Give focus, hover, active, and selected states clear but restrained treatment.
- Keep motion brief and functional.
- Add detail only when it improves understanding, scanning, or feedback.
- Make dense technical information easy to scan before adding extra visual containers or charts.

## Desktop workspace

TideStudio uses a persistent desktop structure with a compact navigation rail, one continuous working surface, and a contextual right inspector when appropriate. The navigation defaults to roughly 220px and remains resizable.

### Left panel

The left panel is product navigation, not the model list itself. It provides stable destinations for current and future areas such as:

- Server
- Models
- Model Search
- Presets
- Settings

Server, Models, and Model Search are implemented destinations. Future destinations may appear quietly as unavailable items without pretending the page exists.

The sidebar follows compact TideCode-like spacing with restrained rounded navigation rows. The Downloads activity control belongs in the sidebar footer; do not show backend/runtime metadata there.

The active navigation item keeps the same selected color on hover. Hover feedback is only for inactive interactive items.

### Center panel

The center panel is the primary working area and should receive the strongest visual emphasis.

The center workspace is a full-height square-edged surface, not an inset rounded card. It runs flush from the top of the workspace to the bottom and is separated from the left navigation and right inspector by fine vertical boundaries. This keeps the working layout immediately familiar to users coming from LM Studio while retaining TideStudio's own visual system.

The center host itself has no global content padding. Each page owns its spacing. Models uses a full-bleed catalog layout so the toolbar and table can span the complete center width, while Server applies its own readable content inset.

Model Search uses a searchable repository list in the center workspace and a repository/file inspector on the right. A compact source dropdown sits beside the search field, with Hugging Face selected by default and ModelScope available as the second source. Keep search results dense and list-oriented rather than turning every model into a large marketplace card. Search is debounced as the user types; do not show a separate Search button. The right inspector shows repository metadata, GGUF files/quantizations, per-file download actions, detected capabilities after completion, and the repository README/model card rendered as Markdown with normal headings, lists, code, tables, emphasis, and links.

For Model Search specifically, follow the LM Studio information hierarchy while keeping TideStudio's own visual system. The center panel uses a fixed page/search toolbar and flat repository rows separated by fine dividers, with publisher identity, compact tags, downloads/likes, and a restrained selected state. The right panel remains a separate inspector and uses a repository title/stats header, open summary sections, Download Options, and README content.

Model Search uses two workspace modes. With no repository selected, the right detail pane is collapsed so the model list owns the available center workspace. Selecting a repository expands the right detail pane to roughly 58% of the post-navigation workspace, leaving the model list as the narrower left side. The expanded divider remains draggable. Closing the model detail returns to browse mode.

Download Options must keep model GGUF files and vision projector mmproj files visibly separate. Both are individually downloadable; do not silently bundle the projector with the model.

Within each Download Options group, use one dropdown to select a GGUF variant and one Download action rather than rendering every quantization as a separate row. Show the selected file's size and quantization; keep projectors in a separate selector.

The Model Search center page fills the complete center panel. Its search field and provider selector remain fixed in place; only the repository results list scrolls vertically. Do not add a separate provider/results heading below the search controls. Download progress does not belong in Model Search.

Global download activity lives in a popover opened from the Downloads utility at the bottom of the sidebar. Active entries show downloaded size, total size, percentage, live transfer speed, and a progress bar. Completed downloads remain in the popover until cleared.

Download progress UI should update at a readable cadence rather than repainting for every network chunk. Active rows use stable metric regions and tabular numbers so transfer speed and byte counts do not visually jump around. In Model Search, an active file's Download button shows its percentage instead of a generic Downloading label.

For the Server page it contains:

- configured models available to launch
- all TideStudio-managed server processes
- server selection and lifecycle actions

For the Models page it contains:

- a dense model catalog table
- model selection

The Models catalog displays only real GGUF files discovered from TideStudio's managed models directory. Metadata should come from filesystem/GGUF inspection; unavailable fields render as Unknown rather than demo values.

Future pages should replace the center content while keeping the surrounding navigation and inspector stable when appropriate.

### Right panel

The right panel is contextual to the active page.

- Server: selected server metadata only. Running-model actions and live API logs belong in the center workspace.
- Models: selected model inspector with Info, Load, and Inference tabs.

Starting and stopping servers belongs to the Server page, not Models.
Server/network settings such as port must not appear in the Models inspector. Models owns only settings that describe how the selected model is loaded or used for inference, including speculative decoding and MTP.

The Server center workspace uses a vertical split similar to LM Studio: an inset, independently scrollable running-model region on top and a docked API Logs panel on the bottom. Running models are full-width cards inside the inset region with visible margin on all sides. Only real managed llama-server processes appear as loaded models; the empty state remains empty when nothing is running.

At the top of the Server center workspace, show a compact control strip with runtime status, Server Settings, the future `mcp.json` entry, the current reachable endpoint with copy action, and Load Model. Copy actions use temporary checkmark feedback after a successful clipboard write. Follow it with a simple `Loaded Models` heading before the runtime cards.

`Load Model` opens a compact desktop-picker dialog rather than navigating away. Position it in the upper portion of the window instead of vertically centering it. Use a search-first top bar, a small sort segmented control, and one dense model list with inline quantization/MTP/publisher metadata. Unloaded rows themselves are the Load action and show only a chevron affordance; loaded models stay in the same list and expose compact Loading/Stop state matching the loaded-model cards. Clicking an unloaded row closes the dialog immediately and inserts an optimistic Loading card.

`Server Settings` opens a dedicated grouped settings dialog. Use compact Connection, Access, and Runtime sections with aligned rows and a footer for Cancel/Apply. Server-wide settings such as public port, authentication, LAN binding, CORS, MCP policy, and JIT loading do not belong in the right inspector.

On the Server page, the right inspector is model-focused and reuses the same Info / Load / Inference model inspector used by Models. Selecting a loaded model in the center updates that inspector.

API Logs is a bottom dock rather than a floating card. Its header remains visible when collapsed, and the horizontal divider above it resizes the expanded panel. Selecting a running-model card controls which server output appears there. Avoid duplicating logs or stop actions in the right inspector.

Place a floating, rounded, collapsible Supported Endpoints panel at the bottom of the upper Server region, above the logs dock. Its header toggles the panel open/closed. Default it to collapsed, and persist its collapsed/open state across app restarts in SQLite. Keep the panel wide across the Server workspace while the segmented control stays compact. Use the shared `SegmentedField` to switch between OpenAI-compatible, Anthropic-compatible, and TypeSafe-compatible endpoint families.

Server-wide startup/restart settings such as public gateway port, local-network binding, API-key authentication, CORS, MCP policy, and JIT policy live in the dedicated Server Settings dialog, not the right inspector. Public gateway settings take effect together through Apply, persist across app launches, and private llama.cpp worker ports are not user-configurable. At app startup, gateway launch is background work and must not gate loading local workers.

Keep configuration vertically scannable and compact. Avoid turning each option into a separate card.

The Models inspector follows the compact hierarchy of LM Studio's right-side model panel: model name at the top, a full-width segmented tab field, then thinly separated disclosure sections. Reuse TideStudio's own colors and typography rather than cloning LM Studio's branding.

Model Load and Inference configuration is per GGUF and persists beside that file in a TideStudio JSON sidecar. In a loaded model's Server inspector, Inference changes affect subsequent API requests immediately without restarting the worker; Load-tab changes are saved but apply on the next load. Explicit request parameters override TideStudio's saved defaults. Loaded-model cards include the detected quantization when known.

The Models library classifies native decision GGUFs as `DECISION` using decision metadata such as `modern-bert.decision.*` and `decision-model` tags. New MTP-capable models default to MTP speculative mode. Embedding models default to llama.cpp embeddings mode.

The Models table uses the desktop-library columns `Model | Publisher | Type | Params | Quant | Context Length | Size | Actions`. Keep rows compact, keep the Model column narrow with ellipsis truncation, and align Actions to the far-right edge with flexible space before it. GGUF itself is implicit because TideStudio only manages GGUF model files. Parameter labels preserve GGUF MoE labels and, when necessary, derive expert layouts such as `64x1.2B` from `*.expert_count` plus expert tensor shapes. Context Length comes from GGUF context metadata. The Actions menu owns reveal-in-folder, identifier/path copy, provider link, and safe deletion.

The Inference tab is organized into Prompt, Reasoning, and Sampling sections for LLMs. Prompt contains the system prompt default. Reasoning controls are shown only for models marked as reasoning-capable and include thinking enablement, effort, budget, and reasoning preservation. Sampling contains the common llama.cpp generation defaults such as temperature, top-k, top-p, min-p, typical-p, seed, and repetition/presence/frequency penalties.

Prompt Template belongs at the bottom of the Load tab as a multiline field. When a GGUF provides `tokenizer.chat_template`, TideStudio prefills that embedded value. Leaving the embedded value unchanged means llama.cpp uses its model default without an explicit override; editing the field sends the edited template as `--chat-template`.

The shared `SegmentedField` follows the TideCode reference pattern: rounded outer field, subtle inset background, equal-width segments, active white surface with a small shadow, and muted inactive segments. Active segments remain visually stable on hover.

## Shared UI components

Reusable controls belong under `studio/src/components/ui/`. Feature components should consume these primitives instead of recreating button, field, switch, status, and section-heading treatments.

Current primitives:

- `Button`
- `Dropdown`
- `InputField`
- `IconButton`
- `SectionHeader`
- `SegmentedField`
- `StatusBadge`
- `Switch`
- `TextAreaField`
- `TextField`

When dropdowns are needed, use the shared custom `Dropdown` rather than a native select. It provides the trigger, menu, selected state, outside-click dismissal, Escape handling, and keyboard navigation.

All text and number inputs use the shared `InputField`. Inputs use a subtle 1px neutral border that remains unchanged on hover and focus, with no focus outline/ring. Number inputs hide native increment/decrement steppers.

### Panel resizing

The separators between left-center and center-right are draggable.

- Start around 20/60/20.
- Preserve minimum usable widths for navigation, center content, and configuration.
- Resize hit areas sit invisibly over the panel edges, matching TideCode's interaction pattern.
- Do not show a divider highlight or hover treatment. The cursor change is the resize affordance.
- Resizing should not introduce decorative handles or heavy chrome.

The center workspace surface is flat, full-height, square-edged, and does not use an edge shadow.

## Adaptation

Preserve the same hierarchy and visual character across window sizes and input methods. Reconsider arrangement where needed instead of merely scaling the desktop layout down.

## Review criteria

The interface should remain coherent even with most decorative effects removed. The main content should be obvious, related elements should feel related, controls should be discoverable, and every visual treatment should earn its place.
