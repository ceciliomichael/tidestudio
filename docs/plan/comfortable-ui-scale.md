# Comfortable UI Scale Plan

## Goal

Increase TideStudio's overall desktop UI scale so text and controls are easier to read without changing the three-panel architecture or interaction density.

## Scale targets

- Base readable text: mostly 12-14px instead of 8-11px.
- Primary headings: 16-18px.
- Buttons and inputs: 40-42px standard height.
- Compact controls: 34-36px.
- Navigation rows: 48px minimum.
- Model/server/search rows: approximately 15-20% taller.
- Inspector labels and metadata: increase while preserving hierarchy.
- Download activity metrics: larger and tabular, but still compact.

## Scope

Modify only CSS sizing/spacing. Do not change application logic, panel ratios, component APIs, or Switch implementation.

## Files

Modify:
- studio/src/styles/global.css
- DESIGN.md
- AGENTS_LEARNING.md
- docs/plan/comfortable-ui-scale.md

## Verification

1. Run npm run build.
2. Confirm no layout code changes.
3. Confirm Model Search, Models, Server, dialogs, inputs, buttons, and inspectors all use the larger scale.
4. Confirm resizable panels still fit the minimum supported window.

## Status

Implemented and verified.

- npm run build passes.
- No application or panel-resizing logic changed.
- Base UI text is 14px with larger headings.
- Standard buttons and inputs are about 40px tall and compact controls about 34-36px.
- Navigation, Models, Server, Model Search, download activity, dialogs, and inspectors all use the larger scale.
- Model Search rows are approximately 82px tall and Server loaded-model rows approximately 72px tall.
