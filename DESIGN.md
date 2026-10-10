# Design

## Visual taste

Create interfaces that feel calm, precise, and quietly polished. Favor clarity over spectacle. Character should come from proportion, typography, spacing, alignment, and small purposeful details rather than decoration.

### Current theme

- TideStudio supports Light, Dark, and System appearance settings, persisted in SQLite. System follows the OS color scheme and responds to changes.
- The current visual tokens and spacing are intentionally aligned with the local TideCode light design system.
- Use Google Sans Flex for interface typography.
- Use a warm near-white shell, soft gray sidebar/inspector surfaces, white primary surfaces, and the TideCode green accent family.
- Settings replaces the normal primary navigation with a dedicated Settings sidebar containing General and Updates. General reuses the shared SegmentedField for Theme and the shared Dropdown for Language. Both controls persist through SQLite UI preferences. Updates displays the installed app version without suggesting an updater is configured.
- Dark appearance should match TideCode's neutral charcoal palette rather than a green-tinted dark surface. The Settings sidebar uses a fine right border against the content area.
- Segmented controls use balanced context-specific sizes: shared defaults, Model Inspector tabs, and Settings Theme use 14px labels and 32px minimum option height; Supported Endpoints uses 13px / 30px. Load Model sorting uses 14px labels in its compact 18px options. Load Model sorting and Settings Theme stay content-sized, with 56px minimum option width rather than a forced wide field. Active labels use near-black in light mode and white in dark mode.
- All segmented controls keep equal 3px inner inset on all four sides, matching the 3px gap between options, with rounded 12px outer and 8px inner corner radii. Feature-specific overrides must preserve this alignment.
- Supported Endpoints and unselected loaded-model cards share the same 1px border token (`--loaded-card-border`) and 12px radius. In dark mode their visible border is `#36363a`; selected model cards retain a green border.
- Primary sidebar navigation labels follow the same contrast rule: near-black in light mode and white in dark mode, including the active item.
- Server terminal/log surfaces use a near-black charcoal background in dark mode with high-contrast light monospace text.
- Loaded-model cards in dark mode should use neutral charcoal surfaces, near-white model names, subtly raised badge surfaces, and only a restrained green tint for the selected card.
- In dark mode, loaded-model cards should be effectively black (`#0f0f10`), with selection communicated primarily by the green border rather than a filled green card. Internal badges use the slightly raised `#171718` surface.
- Desktop Settings content mirrors TideCode alignment: centered `780px` max-width content, about `64px` top spacing and `20px` horizontal padding, `20px` between Appearance and Preferences, compact rows without forced minimum height, content-sized Theme segmented control, and a `240px` Language dropdown. Override the legacy generic `.settings-section` 100% minimum height and padding specifically for `.settings-content > .settings-section` so the two sections stack tightly.
- The Settings workspace uses the regular main-panel surface, border and top-left radius, but has only a left sidebar and main panel. Share the default 220px initial sidebar and 196–280px resize bounds with other pages, preserving the user's sidebar width while navigating. No right inspector or right resize handle appears in Settings.
- Theme selection also updates the Tauri native window: set the native Light/Dark/System mode and background, then on Windows customize the DWM caption, border and text colors to match the sidebar's `--color-sidebar` fill. Light sidebar/caption is `#f0f0f0` and dark sidebar/caption is `#141415`; follow system changes in System mode. Unsupported Windows versions retain their OS caption treatment without changing the app palette.
- App-wide readable typography uses approximately 14–15px for prominent labels and main copy, 12–13px for helper text and metadata, and 13–14px for buttons and inputs. Small badges should not fall below 11px. Explicit component font sizes must be updated directly; changing the body font alone does not enlarge the many fixed-pixel labels. Allow dense controls to truncate or scroll rather than overlap at smaller window sizes.
- Use TideCode deep green (#315F59) for primary actions, with #284F4A on hover. Use soft green (#D9E9E6) for compact active navigation, segments, and selected dropdown options, with #CFE2DE for selected-option hover. Use a faint green tint for larger selected list rows and model cards rather than saturating broad surfaces.
- Keep ordinary model metadata badges neutral. Reserve amber for warnings or distinct capability indications and restrained red for destructive actions; do not assign decorative colors to every model type.
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

TideStudio uses a persistent desktop structure with a compact navigation rail, one continuous working surface, and a contextual right inspector when appropriate. The navigation defaults to roughly 220px and remains resizable. User-resized panel widths persist in SQLite: one shared left width, one standard right-inspector width, and one Model Search detail width. Hydrate these preferences before the first React workspace render so startup never visibly jumps from default widths to saved widths. Persist a new value when a resize gesture finishes, not for every pointer movement or temporary viewport clamp.

### Left panel

The left panel is product navigation, not the model list itself. It provides stable destinations for current and future areas such as:

- Server
- Models
- Model Search
- Downloads
- Settings

Server, Models, Model Search, and Downloads are implemented destinations. Settings is anchored to the bottom of the navigation sidebar without a divider above it; Presets is no longer shown.

The sidebar follows compact TideCode-like spacing with restrained rounded navigation rows. Downloads uses the same row styling and a live active-count badge. Settings is the only bottom navigation action, without a top border or divider; do not show backend/runtime metadata there.

The active navigation item keeps the same selected color on hover. Hover feedback is only for inactive interactive items.

### Center panel

The center panel is the primary working area and should receive the strongest visual emphasis.

The center workspace is a full-height square-edged surface, not an inset rounded card. It runs flush from the top of the workspace to the bottom and is separated from the left navigation and right inspector by fine vertical boundaries. This keeps the working layout immediately familiar to users coming from LM Studio while retaining TideStudio's own visual system.

The center and right workspace panels have a 1px muted top border in light and dark themes. The left navigation and dedicated Settings sidebar have no top border. The main panel still retains its top-left corner radius; there is no divider above the bottom Settings navigation button.

The center host itself has no global content padding. Each page owns its spacing. Models uses a full-bleed catalog layout so the toolbar and table can span the complete center width, while Server applies its own readable content inset.

Model Search uses a searchable repository list in the center workspace and a repository/file inspector on the right. A compact source dropdown sits beside the search field, with Hugging Face selected by default and ModelScope available as the second source. Keep search results dense and list-oriented rather than turning every model into a large marketplace card. Search is debounced as the user types; do not show a separate Search button. The right inspector shows repository metadata, GGUF files/quantizations, per-file download actions, detected capabilities after completion, and the repository README/model card rendered as Markdown with normal headings, lists, code, tables, emphasis, and links.

For Model Search specifically, follow the LM Studio information hierarchy while keeping TideStudio's own visual system. The center panel uses a fixed page/search toolbar and flat repository rows separated by fine dividers, with publisher identity, compact tags, downloads/likes, and a restrained selected state. The right panel remains a separate inspector and uses a repository title/stats header, open summary sections, Download Options, and README content.

Model Search repository badges occupy one visible line: GGUF and Vision/Text come first, followed by additional model tags that fit at the current panel width. Extra tags wrap below the clipped row rather than shrinking or displaying partially; panel resizing naturally changes how many tags are visible without measuring badges in JavaScript.

Model Search uses two workspace modes. With no repository selected, the right detail pane is collapsed so the model list owns the available center workspace. Selecting a repository expands the right detail pane to roughly 58% of the post-navigation workspace, leaving the model list as the narrower left side. The expanded divider remains draggable. Closing the model detail returns to browse mode.

Download Options must keep model GGUF files and vision projector mmproj files visibly separate. Both are individually downloadable; do not silently bundle the projector with the model.

Within each Download Options group, use one dropdown to select a GGUF variant and one Download action rather than rendering every quantization as a separate row. Show the selected file's size and quantization; keep projectors in a separate selector.

The Model Search center page fills the complete center panel. Its search field and provider selector remain fixed in place; only the repository results list scrolls vertically. Do not add a separate provider/results heading below the search controls. Download progress does not belong in Model Search.

Global download activity lives in its own Downloads page at the former Presets navigation position, not a popover. This uses a two-panel workspace without a right inspector, with a fixed Downloads header and a vertically scrollable body. Active cards show downloaded size, total size, percentage, live transfer speed, and a progress bar using the former activity-popover visual language. Completed downloads remain in the page until cleared; the main sidebar item shows a live active count. Model Search remains a separate page with its optional right repository inspector.

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

`Load Model` opens a compact desktop-picker dialog rather than navigating away. Position it in the upper portion of the window instead of vertically centering it. Replace its conventional title bar and separate search row with one 50px search-as-header row: search icon and input on the left, exactly one X action on the right, and the modal's existing rounded top corners. The X clears a nonempty filter on the first click and closes the modal when the filter is empty (including on the next click after clearing). Hide the separate generic modal close button in this dialog. Keep the accessible dialog name `Load Model`, its Escape/outside-click behavior, and search autofocus. Beneath it, display `Your Models` without a model count, with a content-sized 26px-tall sort segmented control in a 38px section heading. The sort field retains the shared border, neutral background, inset shadow, 3px inset/gap, but uses reduced 8px outer / 5px option radii and 14px labels. Do not put a bottom border on the `Your Models` heading: the first model row already supplies the single divider with its top border. Use one dense model list with inline quantization/MTP/publisher metadata. Unloaded rows themselves are the Load action and show only a chevron affordance; loaded models stay in the same list and expose compact Loading/Stop state matching the loaded-model cards. Clicking an unloaded row closes the dialog immediately and inserts an optimistic Loading card.

In the Load Model search header, keep the combined clear/close control a fixed 26px square with zero padding and a centered, block-level 16px X icon. Keep its idle border transparent, background transparent, and shadow removed; preserve subtle hover highlighting. Its size and position must not inherit larger generic icon-button dimensions. The shared `Modal` supports optional custom `headerContent` and `hideCloseButton` without changing its accessible title or other modals' close buttons.

`Server Settings` opens a large, viewport-responsive grouped settings dialog, up to 960px wide and 800px high, with 72px viewport clearance; its body scrolls internally while Cancel/Apply remains docked. Use 15px setting names, 13px descriptions, 14px section headings and inputs, and at least 66px setting rows with readable spacing. Omit the generic title/header row and its X button entirely: the Connection section begins at the top with the existing body padding, and the Cancel/Apply footer remains the visible action area. Keep the dialog's accessible `Server Settings` name and Escape/outside-click dismissal. Use compact Connection, Access, and Runtime sections with aligned rows and a footer for Cancel/Apply. Server-wide settings such as public port, authentication, LAN binding, CORS, MCP policy, and JIT loading do not belong in the right inspector.

On the Server page, the right inspector is model-focused and reuses the same Info / Load / Inference model inspector used by Models. Selecting a loaded model in the center updates that inspector.

API Logs is a bottom dock rather than a floating card. Its header remains visible when collapsed, and the horizontal divider above it resizes the expanded panel. Selecting a running-model card controls which server output appears there. Avoid duplicating logs or stop actions in the right inspector.

Place a floating, rounded, collapsible Supported Endpoints panel at the bottom of the upper Server region, above the logs dock. Its header toggles the panel open/closed. Default it to collapsed, and persist its collapsed/open state across app restarts in SQLite. Keep the panel wide across the Server workspace while the segmented control stays compact. Use the shared `SegmentedField` to switch between OpenAI-compatible, Anthropic-compatible, and TypeSafe-compatible endpoint families.

Server-wide startup/restart settings such as public gateway port, local-network binding, API-key authentication, CORS, MCP policy, and JIT policy live in the dedicated Server Settings dialog, not the right inspector. Public gateway settings take effect together through Apply, persist across app launches, and private llama.cpp worker ports are not user-configurable. At app startup, gateway launch is background work and must not gate loading local workers.

Keep configuration vertically scannable and compact. Avoid turning each option into a separate card.

The Models inspector follows the compact hierarchy of LM Studio's right-side model panel: model name at the top, a full-width segmented tab field, then thinly separated disclosure sections. Reuse TideStudio's own colors and typography rather than cloning LM Studio's branding.

Model Load and Inference configuration is per GGUF and persists beside that file in a TideStudio JSON sidecar. The right inspector is capability-aware: hide controls that do not apply to the model rather than showing one universal form. In a loaded model's Server inspector, Inference changes affect subsequent API requests immediately without restarting the worker; Load-tab changes are saved but apply on the next load. Explicit request parameters override TideStudio's saved defaults. Loaded-model cards include the detected quantization when known.

The Models library classifies native decision GGUFs as `DECISION` using decision metadata such as `modern-bert.decision.*` and `decision-model` tags. New MTP-capable LLMs default to MTP speculative mode. MTP is never offered to models without detected support. Embedding models launch in llama.cpp embeddings mode and expose pooling; rank-pooled rerankers are identified as a separate unsupported public inference mode rather than being presented as ordinary embeddings. Drafter models are configured from the target LLM's speculative-decoding section.

The Models table uses the desktop-library columns `Model | Publisher | Type | Params | Quant | Context Length | Size | Actions`. Keep rows compact, keep the Model column narrow with ellipsis truncation, and align Actions to the far-right edge with flexible space before it. GGUF itself is implicit because TideStudio only manages GGUF model files. Parameter labels preserve GGUF MoE labels and, when necessary, derive expert layouts such as `64x1.2B` from `*.expert_count` plus expert tensor shapes. Context Length comes from GGUF context metadata. The Actions menu owns reveal-in-folder, identifier/path copy, provider link, and safe deletion.

The Models table separates the model data from a fixed 72px Actions pane. The Actions pane never participates in horizontal scrolling. Keep matching 30px headers, 1px body separators, and fixed 44px rows; synchronize the two panes vertically and mirror selection/hover across them. A dedicated horizontal scrollbar is absolutely anchored across the full table width at the bottom, including beneath Actions, and is the only horizontal scroll authority. It writes one shared horizontal offset that translates the model header and model-row content together; the data body itself does not horizontally scroll. This prevents end-of-range snap/teleport behavior while keeping the Actions buttons and icons stationary. Keep the model data grid's `padding-inline: 20px 0` and the Actions pane's internal 12px right gutter.

Within the pinned Actions column, the three-dot control uses a fixed 20px square wrapper and trigger with a centered 14px SVG. Avoid a separate elevated positioning layer on the wrapper, because its menu is already portaled and independently positioned.

The Inference tab is organized into Prompt, Reasoning, and Sampling sections only for LLMs. Prompt contains the system prompt default. Reasoning itself is capability-granular: show the thinking toggle only for templates exposing it, effort only for models/templates that support effort levels, budget for reasoning-capable models, and preserved reasoning only when that capability is present. Sampling contains the common token-generation defaults such as temperature, top-k, top-p, min-p, typical-p, seed, and repetition/presence/frequency penalties. Embedding, Drafter, and DECISION models do not show chat-generation Inference controls.

Prompt Template belongs at the bottom of the LLM Load tab as a multiline field. When a GGUF provides `tokenizer.chat_template`, TideStudio prefills that embedded value. Leaving the embedded value unchanged means llama.cpp uses its model default without an explicit override; editing the field sends the edited template as `--chat-template`. Non-LLM categories do not show the prompt-template editor.

The shared `SegmentedField` follows the TideCode reference pattern: rounded outer field, subtle inset background, equal-width segments, active white surface with a small shadow, and muted inactive segments. Active segments remain visually stable on hover.

## Shared UI components

Reusable controls belong under `studio/src/components/ui/`. Feature components should consume these primitives instead of recreating button, field, switch, status, and section-heading treatments.

Shared `tide-switch` controls use a light gray `#d8d8d8` off-state track in light mode and dark charcoal `#3f3f42` in dark mode, with a white thumb in both. Use the theme-specific `--switch-off-track` token. Keep the existing green theme-specific on-state, switch dimensions, and movement animation.

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
