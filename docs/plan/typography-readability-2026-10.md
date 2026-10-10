# Application typography readability

Approved scope: increase text readability across Server, Models, Model Search, Downloads, General Settings, inspectors, and modals without zooming the window or changing application behavior.

## Planned structure

```text
tidestudio/
  studio/src/styles/global.css        # App-wide type scale and component-fit adjustments
  DESIGN.md                           # Updated visual typography guidelines
  AGENTS_LEARNING.md                  # Durable small-type pitfalls and standards
  docs/plan/
    typography-readability-2026-10.md # This approved implementation plan
```

## File-by-file changes

- Modify `studio/src/styles/global.css`: raise explicit small font sizes across existing component rules, then adjust Server Settings rows, small labels, field spacing, and responsive layout fit. Retain intentional truncation and horizontal scrolling in model lists.
- Modify `DESIGN.md`: document the new readable type ranges and layout constraints.
- Modify `AGENTS_LEARNING.md`: record the need to update explicit component font sizes rather than only the body font.
- Create `docs/plan/typography-readability-2026-10.md`: record the scope and validation of the approved change.

## Verification

- Browser geometry and computed-type checks at desktop and smaller viewports, in both themes, for representative application controls and dense layouts.
- `npm run build && git diff --check` in `studio`.

Completed: 190 explicit small font-size rules and 6 monospace shorthand rules enlarged, with Server Settings spacing and input sizing adjusted. Representative browser checks passed in light/dark at 1000×720 and 1600×1100 window settings; the responsive Server Settings footer remained visible and its body independently scrollable. Production build, TypeScript checks, and `git diff --check` passed. The existing Vite bundle-size warning is non-blocking.
