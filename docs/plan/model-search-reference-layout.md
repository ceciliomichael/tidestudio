# Model Search Reference Layout Plan

## Goal

Restyle both Model Search panels to closely match the supplied LM Studio reference while preserving TideStudio behavior and visual identity.

## Center layout

- Compact page heading.
- Large prominent search control directly beneath the heading.
- Small search/source metadata row.
- Scroll-only result list.
- Larger rounded repository cards with clearer hierarchy.

## Repository cards

Each row will show:
- repository/model icon
- model/repository name
- publisher
- compact capability/repository tags
- download count
- like count
- selected state
- subtle chevron affordance

Cards remain clickable to drive the existing right-side repository inspector.

## Right inspector

Use an LM Studio-like vertical information hierarchy:

- repository title
- downloads / likes / last-updated stats
- summary card with format, pipeline/domain, tags, and inferred capabilities
- Download Options section
  - model GGUF files
  - mmproj / vision projector files
  - each remains individually downloadable
  - active downloads show percentage in-place
- README section using the repository's real Hugging Face README when available

The right panel remains a separate resizable inspector. Do not merge it into the center Model Search list.

## Behavior preserved

- 350ms debounced search
- fixed search/header region
- only results list scrolls
- no in-page download progress
- right inspector handles GGUF file downloads
- global header popover handles download activity

## Files

Modify:
- studio/src/features/downloads/DownloadsBrowser.tsx
- studio/src/features/downloads/DownloadInspector.tsx
- studio/src/features/downloads/types.ts
- studio/src/styles/global.css
- studio/src-tauri/src/core/downloads/huggingface.rs
- DESIGN.md
- docs/plan/model-search-reference-layout.md

## Verification

1. Run npm run build.
2. Confirm search remains debounced.
3. Confirm only results list scrolls.
4. Confirm repository selection still drives the right inspector.
5. Confirm no download progress UI returns to Model Search.
6. Confirm right inspector shows repository stats, summary, grouped download options, and README.
7. Confirm mmproj files remain individually downloadable.

## Status

Implemented and verified.

- cargo fmt --all passes.
- cargo check passes.
- npm run build passes.
- Center Model Search uses the reference-style prominent search field and larger rounded repository rows.
- Search remains debounced at 350ms and only the result list scrolls.
- The right panel remains separate from the center panel.
- Right inspector now includes repository title/stats, summary tags/capability hints, grouped Download Options, and README.
- Model GGUFs and mmproj vision projectors are separate download groups and remain individually downloadable.
- Hugging Face repository details now fetch the real README when available.
