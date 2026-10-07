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

Server and Models are implemented destinations. Future destinations may appear quietly as unavailable items without pretending the page exists.

The sidebar follows TideCode-like spacing: compact top spacing, approximately 16-20px horizontal breathing room, and compact rounded navigation rows. Do not show backend/runtime metadata in the sidebar footer.

The active navigation item keeps the same selected color on hover. Hover feedback is only for inactive interactive items.

### Center panel

The center panel is the primary working area and should receive the strongest visual emphasis.

The center workspace is a full-height square-edged surface, not an inset rounded card. It runs flush from the top of the workspace to the bottom and is separated from the left navigation and right inspector by fine vertical boundaries. This keeps the working layout immediately familiar to users coming from LM Studio while retaining TideStudio's own visual system.

For the Server page it contains:

- configured models available to launch
- all TideStudio-managed server processes
- server selection and lifecycle actions

For the Models page it contains:

- local model library
- model selection

Future pages should replace the center content while keeping the surrounding navigation and inspector stable when appropriate.

### Right panel

The right panel is contextual to the active page.

- Server: selected server metadata, stop action, and runtime logs.
- Models: selected model launch configuration only.

Starting and stopping servers belongs to the Server page, not Models.

Keep configuration vertically scannable and compact. Avoid turning each option into a separate card.

## Shared UI components

Reusable controls belong under `studio/src/components/ui/`. Feature components should consume these primitives instead of recreating button, field, switch, status, and section-heading treatments.

Current primitives:

- `Button`
- `IconButton`
- `SectionHeader`
- `StatusBadge`
- `Switch`
- `TextField`

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
