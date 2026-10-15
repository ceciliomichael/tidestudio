# TideStudio Color System Parity With TideCode

**Status:** Implemented after user approval. Automated verification passed; live light/dark/system screenshot and interaction checks remain unverified.
**Workspace:** `D:\tidestudio` (`main` branch)
**Reference:** `C:\Users\Admin\Desktop\tidecode\src\index.css` and its `DESIGN.md`, inspected on 2026-10-13.
**Scope:** All TideStudio-owned light/dark/system appearance surfaces, including shared controls, independently styled feature pages, dialogs, runtime controls, native window chrome and tray popup.

## 1. Goal and unambiguous target

Implement the **final**, not intermediate, TideCode color contract. Preserve TideStudio's existing UI layout, typography, geometry, interactions, model operations and separate runtime functionality. This is a visual-system migration, not a feature rewrite or a wholesale copy of TideCode's React/Tailwind components.

The explicit TideCode corrections to carry over:

1. The pale-green **selected sidebar/history item** is the accent reference, **not** the neutral sidebar background.
2. Light selected/action fill `#d9e9e6`, hovered `#cfe2de`, foreground **black `#000000`**.
3. Dark selected/action fill `#223630`, hovered `#2a443d`, foreground **white `#ffffff`**. This applies to green badges (GGUF), selected navigation, active segments, primary actions, and switch thumbs.
4. Checked switches use the action/selected green fill with the action foreground as thumb; unchecked tracks/thumbs use distinct neutral tokens. Do not use black checked-switch thumbs.
5. **Light mode** has restrained selected/accent outlines. **Dark mode** has no visible accent outline on those green surfaces (transparent reserved border width). Preserve ordinary structural/input/focus/error borders.
6. Split actions have **one divider** between primary and chevron, in *both* appearances, while avoiding doubled inner/outer borders. In dark mode their green outer accent outline is transparent.
7. Neutral dark mode starts from near-black `#0f0f10`; higher surfaces use slightly lighter charcoal. Light mode mirrors this hierarchy.
8. Semantic success, warning, danger and info are distinct from the decorative green selection; do not recolor all statuses green.
9. Intentional exceptions: runtime logs, diagnostic/code blocks, syntax/terminal ANSI colors, user/model content, file/document previews, model category meaning, and genuine external branding.

## 2. Confirmed source audit

TideStudio is **Tauri + React + plain CSS**, not TideCode's Electron + Tailwind setup. Its UI styles are largely in `studio/src/styles/global.css`, which contains roughly 6,400 lines and several later overrides. Copying TideCode class names into JSX will not generate the corresponding CSS. Prefer the existing `ui-*`, `tide-*`, and feature classes.

### Current source-level mismatches

| Priority | Current source | Evidence and required change |
| --- | --- | --- |
| P0 | `studio/src/styles/global.css:25-48, 69-88` | `--color-action`, `--button-primary-background`, `--load-control-accent` and `--segmented-control-active-surface` have different values. Make each an explicitly documented semantic role, with the *same TideCode selected/action* palette where selection/action is intended. |
| P0 | `global.css:614-619, 4901-4915, 6024-6031` | Main navigation and Settings navigation presently use dark-green/white selected fills in light mode, and separate dark overrides. Align active rows with TideCode's pale-green selected history/sidebar treatment; light accent border, dark no visible accent border. |
| P0 | `global.css:747-756, 3090-3091, 4682, 6250-6324, 6404` | Buttons, load controls, runtime split actions and other local actions use different green fills. Align actual action controls; preserve meaningful progress/status colors. |
| P0 | `studio/src/components/ui/Switch.tsx:18-30` and `global.css:1000-1038` | Shared switch uses Tailwind-like `bg-brand`/`bg-border`/`bg-white` strings even though the project has no Tailwind pipeline; most callers add `tide-switch`. Make the shared component explicitly own the TideStudio class and state contract, and use `--switch-* ` tokens for on/off tracks and thumbs. |
| P1 | `global.css:1051-1099` | Segmented-field active color uses a separate hardcoded dark fill and white text, conflicting with selected sidebar and dropdown state. Align active fill, text, hover, and border roles while preserving field sizing/inset. |
| P1 | `global.css:1158-1281` | Dropdown trigger/menu/options have literal black/white text overrides and independent selected/hover styling. Align selected and idle text, action-mode menu, background stack, borders and selected hover. Do not change pointer-versus-keyboard menu behavior. |
| P1 | `global.css:6244-6324` | Runtime split button has separate main/chevron fills and fixed white/15 divider. Enforce one theme-aware divider and one optional outer accent outline; avoid duplicate seams and keep menu outside clipped surfaces. |
| P1 | `global.css:1428, 1535, 3947, 4018, 5732-5745` | Model/search/download selected rows/cards use a mixture of faint fills and strong green borders. Align selected state with the TideCode accent policy; dark-mode selected emphasis should come from fill, not a bright green outline. Preserve neutral structural model-card borders. |
| P1 | `global.css:821-841, 867-885` | Modal backdrop and success badge have local style logic. Use one theme-specific overlay role, raised surface role, and semantic success/background/border/foreground rather than treating success as generic selection. |
| P1 | `global.css:305, 1782-1830, 3200, 5680, 6181` | Download percentages, range controls, server status dots and installing-row backgrounds source their colors from primary button accent. Separate statuses/progress from selections, keep progress legible against both surfaces. |
| P1 | `studio/src/tray/menu.css:1-15` and `studio/src/tray/menu.ts` | Tray's independent system-media colors are not TideStudio's final palette and may diverge from the app's explicitly chosen light/dark appearance. Mirror minimal theme roles and synchronize the effective appearance where supported. |
| P1 | `studio/index.html:6`, `studio/src/lib/appearance.ts`, `studio/src-tauri/src/commands/window.rs:44` | Browser metadata, app appearance, DWM caption text colors currently have independent values; align to the sidebar shell palette and preserve SQLite as the saved appearance source of truth. |
| P2 | Later CSS overrides around lines 4336, 4882, 5900 and 5942 onward | Later overrides can silently undo central changes. Audit final cascade order and all `data-theme="dark"` selectors before claiming parity. |

### Preserved local work: mandatory

The working tree on `main` was **already dirty before this plan**, including `ARCHITECTURE.md`, `DESIGN.md`, `CHANGELOG.md`, `studio/package.json`, `studio/package-lock.json`, `studio/src/app/App.tsx`, `studio/src/styles/global.css`, multiple model-memory modules, and new files for estimated-memory-usage work.

- Do not discard, overwrite, stage, commit or reformat existing unrelated changes.
- The current `global.css` diff includes a grid layout, memory breakdown, and note for `.load-model-settings__memory-card`. Preserve these exact functional changes.
- During implementation, apply narrow edits to the *working tree*, not replacements from HEAD. Verify the diff before and after each checkpoint.
- Do not bundle model-memory/Rust/inference work into this migration.
- No new dependencies for theming.

## 3. Color and component contract

The following are **reference values**, verified from the TideCode source. Names may be adapted to TideStudio's plain-CSS conventions.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f6f7f6` | `#0f0f10` |
| Base surface | `#ffffff` | `#171718` |
| Muted field/card surface | `#f0f2f0` | `#202022` |
| Raised popup surface | `#ffffff` | `#242426` |
| Hover surface | `#e9ecea` | `#2a2a2d` |
| Pressed surface | `#e1e5e2` | `#323236` |
| Sidebar/shell | `#eef1ef` | `#131314` |
| Sidebar hover | `#e4e8e5` | `#1c1c1e` |
| Primary text | `#202221` | `#e9e9ea` |
| Muted text | `#666b68` | `#b5b5b8` |
| Subtle text | `#8a908c` | `#8f8f95` |
| Neutral border | `#d4d9d5` | `#38383d` |
| Muted border | `#e1e5e2` | `#2c2c30` |
| Brand foreground | `#315f59` | `#87aea4` |
| Selected/action fill | `#d9e9e6` | `#223630` |
| Selected/action hover | `#cfe2de` | `#2a443d` |
| Selected item and green badge text | **`#000000`** | **`#ffffff`** |
| **Primary action text** | **`#000000`** | **`#ffffff`** |
| Accent/selected border | `#789a93` or softer selected-item mix | **transparent** |
| Unchecked switch track | `#8b918d` | `#68686e` |
| Unchecked switch thumb | `#ffffff` | `#ffffff` |
| Modal backdrop | `rgb(0 0 0 / 0.32)` | `rgb(0 0 0 / 0.62)` |
| Dark split divider | n/a | **visible** `rgb(255 255 255 / 0.26)` |

Other semantic families must mirror TideCode: success, warning, danger, info with matching text/surface/border and distinct disabled state. Keep actual status indicators colored if their meaning would be lost by using the pale green action surface.

**Implementation rule:** The TideStudio names `--button-primary-*`, `--load-control-accent`, `--color-action` and `--segmented-control-active-surface` should not stay independent competing palettes. Either make them intentional aliases of semantic tokens or update directly related selectors and remove obsolete copies when safe. The exact aliases/roles will be recorded in `DESIGN.md`.

### Border policy

- Green selected and primary-action controls: light mode gets **one** restrained accent outline; dark mode uses a transparent border of the same width. Preserve sizing, no shifts when changing theme.
- Runtime split action: exactly one internal divider, both modes. No duplicated shadow/border on either half, no menu clipping. Preserve existing 32px / 66px + 24px geometry and click/keyboard behavior.
- Regular cards, tab containers, form inputs, logs, dialogs, focus indicators and error containers keep their **structural** borders where they communicate hierarchy.
- Do not remove all borders in dark mode: the user meant the green-accent treatment, not every separation line.

## 4. Complete app-owned surface audit matrix

Inspect *both shared primitives and feature-owned markup*, including all local CSS overrides, in **light, dark and system** modes.

| Surface | Files to inspect | States and requirements |
| --- | --- | --- |
| Main app navigation and shell | `studio/src/app/NavigationPanel.tsx`, `ResizableWorkspace.tsx`, `App.tsx`, `studio/src/styles/global.css` | Active/idle/hover; downloads count; topbar, resizers, panel boundaries, Settings link, light/dark transitions. |
| Settings General | `features/settings/GeneralSettings.tsx` | Appearance segmented selected text/fill, language dropdown, labels, descriptions, row/card surfaces. |
| Settings Configuration | `features/settings/ConfigurationSettings.tsx` | Path fields, Browse/Default buttons, status/error, separators, disabled controls. |
| Settings Runtimes | `features/settings/RuntimeSettings.tsx` | Runtime rows, version/status chips, Automatic/Preferred, installing/download progress, Use split button, chevron divider, dropdown, errors/skeletons. |
| Settings sidebar | `features/settings/SettingsSidebar.tsx` | General/Configuration/Runtimes active row against same `brand-soft` selected navigation treatment, subtle borders. |
| Model library | `features/models/ModelLibrary.tsx`, `ModelInspector.tsx`, `ModelInfoTab.tsx`, `ModelLoadTab.tsx`, `ModelInferenceTab.tsx` | Table row hover/selected, pinned action menu, metadata badges, model inspector tabs, code/prompt fields, numeric controls, ranges, switches. |
| Model Search | `features/downloads/DownloadsBrowser.tsx`, `DownloadInspector.tsx` | Source selector, search field, results, selected repository, download state/actions, README markdown/code rendering, badges/empty/error. |
| Downloads | `features/downloads/DownloadActivityPage.tsx` | Download activity rows/cards, status/progress colors, Stop, completed/empty/error, selection. |
| Server dashboard | `features/server/ServerDashboard.tsx`, `SupportedEndpointsPanel.tsx`, `ServerLogsPanel.tsx` | Header state, active model cards, endpoint segments, controls, progress, log output and panel dividers. |
| Server dialogs | `features/server/LoadModelDialog.tsx`, `LoadModelSettingsPage.tsx`, `ServerSettingsDialog.tsx` | Modal backdrop, search header, nested settings, sliders, memory breakdown, compact actions, confirm/cancel, loading and errors. |
| Shared controls | `components/ui/Button.tsx`, `IconButton.tsx`, `Switch.tsx`, `Dropdown.tsx`, `SegmentedField.tsx`, `InputField.tsx`, `TextAreaField.tsx`, `Modal.tsx`, `StatusBadge.tsx`, `SectionHeader.tsx`, `CollapsibleSection.tsx` | Every variant and state, dark-only overrides, portal/dropdown visibility and keyboard affordances. |
| Native/tray/startup | `lib/appearance.ts`, `studio/index.html`, `src-tauri/src/commands/window.rs`, `tray/menu.css`, `tray/menu.ts` | Native caption/background, system changes, initial paint, standalone tray and saved choice. |

**Exclusions:** Do not recolor the bytes of downloaded models, logs' semantic ANSI sequences, external README images, generated icons, user-supplied content, or Tauri backend/model-discovery logic. Do not edit any inference/memory-estimation code as part of color parity.

## 5. Concrete implementation sequence

1. **Baseline:** Record current Git working tree and preserve the uncommitted memory-layout CSS hunk. Capture current appearance state for representative screens if graphical inspection is available; otherwise mark visual QA unverified.
2. **Tokens first:** Bring the `:root` and `:root[data-theme="dark"]` palette of `global.css` into agreement with the TideCode contract. Add only roles actively used by TideStudio. Move from competing green constants to semantic aliases. Make structural surfaces and disabled, warning, danger, success and info roles coherent.
3. **Shared controls:** Normalize Button, Switch, SegmentedField, Dropdown, Modal, StatusBadge, Input/IconButton. Preserve existing control geometry, keyboard semantics, and the scroll/portal behavior of menus.
4. **All feature-owned CSS:** Walk the surface matrix in order. Reconcile selected rows, list cards, model badges, sliders, runtime status and progress, settings sections, server logs, search/download pages. Check later CSS overrides so no page retains a stronger old selector.
5. **Split buttons:** Rework only the applicable `.runtime-settings__split` CSS to use one shared outer border and one inner divider, with the light/dark border policy. Preserve all menus and Preferred/Use states.
6. **Native/tray and appearance:** Match Tauri caption and app meta colors to the sidebar palette. Update tray's independent neutral palette. Where supported, propagate effective saved/system appearance to the tray without creating another persistent preference store; retain SQLite as the app preference authority.
7. **Checks and documentation:** Test token parity, foreground contrast, semantic exceptions, split divider, dark transparent accent borders, and system theme propagation; run existing tests, TypeScript, Vite, and a scoped lint/check where available. Update project design/architecture knowledge to remove contradictory old color requirements, preserving unrelated local edits.

If a feature-specific markup change becomes necessary during implementation, first amend the planned file list and avoid growing beyond the color-system scope.

## 6. Planned project tree

```text
D:\tidestudio\
  AGENTS.md                              [unchanged]
  AGENTS_LEARNING.md                     [modify: durable styling preference]
  ARCHITECTURE.md                        [modify: theme ownership and tray/native sync]
  DESIGN.md                              [modify: exact finalized two-theme contract]
  docs/
    plan/
      tidecode-theme-parity.md           [create: this plan]
  studio/
    index.html                           [modify: initial theme metadata]
    src/
      lib/
        appearance.ts                    [modify: active theme/meta + tray sync if required]
      styles/
        global.css                       [modify: source of truth; preserve dirty memory CSS]
        themeConsistency.test.ts         [create: color/contrast/regression tests]
      components/
        ui/
          Switch.tsx                     [modify: remove nonfunctional Tailwind-only palette classes;
                                         apply semantic switch state styles]
          Button.tsx                     [audit only; existing variant API remains]
          Dropdown.tsx                   [audit only; existing menu behavior remains]
          SegmentedField.tsx             [audit only; existing selection behavior remains]
          IconButton.tsx                 [audit only]
          InputField.tsx                 [audit only]
          TextAreaField.tsx              [audit only]
          Modal.tsx                      [audit only]
          StatusBadge.tsx                [audit only]
          SectionHeader.tsx              [audit only]
          CollapsibleSection.tsx         [audit only]
      app/                               [audit only; no behavioral change expected]
      features/
        settings/                        [audit all three pages]
        models/                          [audit library and inspector]
        downloads/                       [audit search, inspector, activity]
        server/                          [audit dashboard, controls, dialogs, logs]
      tray/
        menu.css                         [modify: theme-specific tray palette]
        menu.ts                          [modify: effective appearance sync]
    src-tauri/
      src/
        commands/
          window.rs                      [modify: exact native caption text colors]
```

### Explicit file-by-file change list

| Operation | File | Responsibility |
| --- | --- | --- |
| **MODIFY** | `studio/src/styles/global.css` | Semantic light/dark palettes, final cascade reconciliation, app-wide and page-local colors, transparent dark accent outlines, semantic statuses, primary/secondary/selected states, runtime split seam. Preserve the existing memory-card layout edits. |
| **MODIFY** | `studio/src/components/ui/Switch.tsx` | Ensure shared switch always uses the real TideStudio CSS class and state tokens rather than relying on Tailwind-like ungenerated classes. Preserve ARIA, callback and animation. |
| **MODIFY** | `studio/src/lib/appearance.ts` | Align browser theme color, the existing Tauri resolved theme, and tray effective appearance if needed. Retain persisted SQLite preference and system event handling. |
| **MODIFY** | `studio/index.html` | Align prepaint/meta theme color with the selected sidebar palette; avoid introducing a second saved preference. |
| **MODIFY** | `studio/src/tray/menu.css` | Use the same light/dark neutral surfaces, borders, foreground and hover tones as app-owned popovers. |
| **MODIFY** | `studio/src/tray/menu.ts` | Follow resolved light/dark/system appearance and app updates, preserving tray actions. |
| **MODIFY** | `studio/src-tauri/src/commands/window.rs` | Align native caption text color with renderer palette; keep existing Windows compatibility behavior. |
| **CREATE** | `studio/src/styles/themeConsistency.test.ts` | Guard semantic token values/relationships, WCAG contrast pairs, action/selected parity, dark accent border transparency, runtime split divider, and CSS-only shared switch wiring. |
| **MODIFY** | `DESIGN.md` | Record finalized colors and border policy; supersede conflicting earlier statements about saturated primary actions, white light-mode nav labels, and dark selected-card green borders. Preserve all other instructions. |
| **MODIFY** | `ARCHITECTURE.md` | Document CSS ownership, native caption, and standalone tray theme flow. Preserve current uncommitted architecture changes. |
| **MODIFY** | `AGENTS_LEARNING.md` | Record user's durable cross-project preference for identical TideCode soft-green selected/action color semantics and theme-specific border/foreground rules, without unrelated preferences. |
| **CREATE** | `docs/plan/tidecode-theme-parity.md` | This reviewed plan; update its status only when work is actually verified. |

**No planned deletes, renames, dependency additions or backend/inference-model changes.** Feature TSX files listed in the audit matrix are **audit-only** because their present theme colors are owned by `global.css`; they should not be rewritten without identifying an actual missing CSS seam.

## 7. Verification and release gate

### Automated
- `cd studio && npm test` (includes the new theme consistency tests).
- `cd studio && npx tsc --noEmit`.
- `cd studio && npx vite build` for frontend CSS output. Full `npm run build` additionally builds the Go gateway; run if environment supports its existing dependencies.
- `git diff --check` and review diff against the pre-existing dirty worktree.
- No undefined token references; no primary action bypassing shared roles except specifically documented exceptions.
- Contrast: 4.5:1 for normal foreground text on its **actual** fill (including dark primary white), 3:1 for meaningful control boundaries; visually assess disabled/read-only states.
- Verify only **one** split divider, no double borders or gap; light-mode green action outline visible; dark-mode green outline transparent.
- Verify strong hardcoded literal text/fills do not survive where they should be semantic, including late `global.css` overrides.
- Verify model-memory estimation feature and pre-existing local CSS layout edits remain intact.

### Visual and interactive acceptance
- **Light, Dark, and System**, including changing OS theme while System is selected.
- Main navigation, all three Settings pages and nested menus, Models table/inspector, Model Search results/download actions, Downloads activity, Server dashboard/logs/endpoints, all dialogs, forms, controls, loading/disabled/error states.
- Compare selected navigation, main action, segmented active option, selected dropdown option and checked switch side-by-side against TideCode's reference palette.
- Test dark-mode switch thumb visibility; no white text on pale-green primary fills in light mode.
- Test runtime split chevron via mouse, keyboard, menu open/close; preserve one divider in both appearances.
- Check tray popup and Windows caption when explicitly choosing each appearance and switching the OS.
- If no GUI is available in this workflow, mark all visual checks **unverified** rather than claiming complete parity.

**Completion:** No partial success claims. Record which automated checks pass, any blocked checks, and any unverified GUI checks. Do not stage, commit, push, publish or release without a separate request.

## Implementation verification

Approved by the user and implemented without a new dependency. The semantic palette, shared Switch, navigation/Settings selected states, dialogs, dropdowns, segmented controls, model-card selections, runtime split divider, semantic status/progress colors, native caption, and separate tray appearance were updated. Existing non-theme application behaviors and the dirty model-memory layout work remain in place.

- `cd studio && npm test -- --reporter=dot`: **19 passed, 0 failed** across 2 suites, including 7 new color/appearance regression tests.
- `cd studio && npx tsc --noEmit`: **passed**.
- `cd studio && npm run build`: **passed**, including gateway build and renderer/tray Vite bundles. Vite reported an existing >500 kB bundle-size advisory, not a build failure.
- `cargo check --manifest-path studio/src-tauri/Cargo.toml`: **passed**.
- `git diff --check`: **passed** on final worktree review.

The initial 15-file dirty working tree on `main` included a separate model-memory-estimation feature; it was not reset, staged, committed, or pushed. Color changes to `studio/src/styles/global.css` were applied as focused patches, preserving the pre-existing memory-card grid, breakdown, and note.

**Not verified:** Running TideStudio's native GUI and capturing light/dark/system screenshots, exercising runtime menu keyboard/pointer interactions and tray/window theme updates on the actual desktop. Automated source/build checks do not substitute for this visual QA.

No commit, push, or release was requested or performed.

### Green-accent text and Model Search source dropdown follow-up (2026-10-14)

After review, the user clarified that **every green-accented UI element**, including selected rows, buttons, active segments, checked switch thumbs and GGUF badges, must have **black `#000000` foreground in light mode** and **white `#ffffff` foreground in dark mode**. The centralized action and brand-soft foreground tokens now match. CSS-owned format badges and icon/state accents were audited, especially the later `.downloads-result__meta .downloads-result__format` override, which previously reset the GGUF badge to neutral colors. Semantic progress, warning and error states remain separate.

The Model Search Hugging Face/ModelScope source menu was also showing an unwanted tiny vertical scrollbar. The shared `Dropdown` measurement used `scrollHeight` directly as a CSS border-box `max-height`, omitting border thickness. It now includes border height and a one-pixel rounding allowance, while still clamping long dropdown menus to their viewport/max height. Added focused sizing and GGUF badge regression tests.

- `cd studio && npm test -- --reporter=dot`: **22 passed, 0 failed**.
- `cd studio && npx tsc --noEmit`: **passed**.
- `cd studio && npm run build`: **passed**, including the gateway and renderer/tray builds; existing chunk-size advisory remains.
- Visual runtime confirmation of the source menu and both theme modes remains **unverified**.
