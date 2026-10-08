# Design

## Visual taste

Create interfaces that feel calm, precise, and quietly polished. Favor clarity over spectacle. Character should come from proportion, typography, spacing, alignment, and small purposeful details rather than decoration.

### Current theme

- TideStudio is light-mode only for now. Do not add a dark theme, theme selector, or dark-theme variables until explicitly requested.
- The current visual tokens and spacing are intentionally aligned with the local TideCode light design system.
- Use Google Sans Flex for interface typography.
- Use a warm near-white shell, soft gray sidebar/inspector surfaces, white primary surfaces, and the TideCode green accent family.
- Prefer 12px rounded controls, fine neutral borders, and restrained low-opacity shadows.

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
- Use a comfortable desktop scale. Most readable UI text should sit around 12-14px, primary headings around 16-18px, standard controls around 40-42px tall, compact controls around 34-36px, navigation rows around 48px, and primary model/server rows around 70-82px.
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

TideStudio uses a persistent three-panel desktop structure with an initial approximate 20/60/20 balance.

### Left panel

The left panel is product navigation, not the model list itself. It provides stable destinations for current and future areas such as:

- Server
- Models
- Downloads
- Presets
- Settings

Server, Models, and Downloads are implemented destinations. Future destinations may appear quietly as unavailable items without pretending the page exists.

The sidebar follows TideCode-like spacing: compact top spacing, approximately 16-20px horizontal breathing room, and compact rounded navigation rows. Do not show backend/runtime metadata in the sidebar footer.

The active navigation item keeps the same selected color on hover. Hover feedback is only for inactive interactive items.

### Center panel

The center panel is the primary working area and should receive the strongest visual emphasis.

The center workspace is a full-height square-edged surface, not an inset rounded card. It runs flush from the top of the workspace to the bottom and is separated from the left navigation and right inspector by fine vertical boundaries. This keeps the working layout immediately familiar to users coming from LM Studio while retaining TideStudio's own visual system.

The center host itself has no global content padding. Each page owns its spacing. Models uses a full-bleed catalog layout so the toolbar and table can span the complete center width, while Server applies its own readable content inset.

Model Search uses a searchable Hugging Face repository list in the center workspace and a repository/file inspector on the right. Keep search results dense and list-oriented rather than turning every model into a large marketplace card. Search is debounced as the user types; do not show a separate Search button. The right inspector shows repository metadata, GGUF files/quantizations, per-file download actions, and detected capabilities after completion.

For Model Search specifically, follow the LM Studio reference hierarchy while keeping TideStudio's own visual system. The center panel uses a prominent fixed search field and larger rounded repository rows with publisher identity, compact tags, downloads/likes, and a clear selected state. The right panel remains a separate inspector and uses a repository title/stats header, summary/capability card, Download Options, and README sections.

Model Search uses two workspace modes. With no repository selected, the right detail pane is collapsed so the model list owns the available center workspace. Selecting a repository expands the right detail pane to roughly 58% of the post-navigation workspace, leaving the model list as the narrower left side. The expanded divider remains draggable. Closing the model detail returns to browse mode.

Download Options must keep model GGUF files and vision projector mmproj files visibly separate. Both are individually downloadable; do not silently bundle the projector with the model.

Within each Download Options group, use one dropdown to select a GGUF variant and one Download action rather than rendering every quantization as a separate row. Show the selected file's size and quantization; keep projectors in a separate selector.

The Model Search center page fills the complete center panel. Its page header, search controls, and results heading remain fixed in place; only the repository results list scrolls vertically. Download progress does not belong in Model Search.

Global download activity lives in a header popover opened from the download icon beside server status. Active entries show downloaded size, total size, percentage, live transfer speed, and a progress bar. Completed downloads remain in the popover until cleared.

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

At the top of the Server center workspace, show a compact control strip with runtime status, Server Settings, the future `mcp.json` entry, the current reachable endpoint with copy action, and Load Model. Follow it with a simple `Loaded Models` heading before the runtime cards.

`Load Model` opens a centered model-manager dialog rather than navigating away. The dialog contains a filter field, Currently Loaded models with Eject actions, the local model catalog with Load actions, and the manual-load-parameters toggle.

`Server Settings` opens a dedicated settings dialog. Server-wide settings such as public port, authentication, LAN binding, CORS, MCP policy, and JIT loading do not belong in the right inspector.

On the Server page, the right inspector is model-focused and reuses the same Info / Load / Inference model inspector used by Models. Selecting a loaded model in the center updates that inspector.

API Logs is a bottom dock rather than a floating card. Its header remains visible when collapsed, and the horizontal divider above it resizes the expanded panel. Selecting a running-model card controls which server output appears there. Avoid duplicating logs or stop actions in the right inspector.

Place a collapsible Supported Endpoints panel at the bottom of the upper Server region, above the logs dock. Its header toggles the panel open/closed. Default it to collapsed, and persist its collapsed/open state across app restarts in SQLite. Use the shared `SegmentedField` to switch between OpenAI-compatible, Anthropic-compatible, and llama.cpp endpoint families.

Server-wide startup/restart settings such as port, local-network binding, API-key authentication, CORS, MCP policy, and JIT policy live in the dedicated Server Settings dialog, not the right inspector.

Keep configuration vertically scannable and compact. Avoid turning each option into a separate card.

The Models inspector follows the compact hierarchy of LM Studio's right-side model panel: model name at the top, a full-width segmented tab field, then thinly separated disclosure sections. Reuse TideStudio's own colors and typography rather than cloning LM Studio's branding.

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
