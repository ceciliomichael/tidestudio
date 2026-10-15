// Vitest runs under Node; the renderer's TS config intentionally omits Node declarations.
// @ts-expect-error Node built-in types are not included in the frontend TypeScript project.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./global.css", import.meta.url), "utf8") as string;
const switchSource = readFileSync(new URL("../components/ui/Switch.tsx", import.meta.url), "utf8") as string;
const appearanceSource = readFileSync(new URL("../lib/appearance.ts", import.meta.url), "utf8") as string;
const traySource = readFileSync(new URL("../tray/menu.ts", import.meta.url), "utf8") as string;
const trayCss = readFileSync(new URL("../tray/menu.css", import.meta.url), "utf8") as string;
const loadModelDialogSource = readFileSync(new URL("../features/server/LoadModelDialog.tsx", import.meta.url), "utf8") as string;

function themeTokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);

  return Object.fromEntries(
    [...css.slice(start, end).matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

const light = themeTokens(":root");
const dark = { ...light, ...themeTokens(':root[data-theme="dark"]') };

function luminance(color: string): number {
  expect(color).toMatch(/^#[0-9a-f]{6}$/i);

  const [red, green, blue] = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("TideStudio TideCode theme parity", () => {
  it("uses the same inverse surface and sidebar hierarchy", () => {
    expect(light["--color-background"]).toBe("#f6f7f6");
    expect(light["--color-sidebar"]).toBe("#eef1ef");
    expect(light["--color-surface"]).toBe("#ffffff");
    expect(dark["--color-background"]).toBe("#0f0f10");
    expect(dark["--color-sidebar"]).toBe("#131314");
    expect(dark["--color-surface"]).toBe("#171718");

    expect(luminance(light["--color-surface"])).toBeGreaterThan(
      luminance(light["--color-background"]),
    );
    expect(luminance(light["--color-background"])).toBeGreaterThan(
      luminance(light["--color-surface-muted"]),
    );
    expect(luminance(dark["--color-background"])).toBeLessThan(
      luminance(dark["--color-surface"]),
    );
    expect(luminance(dark["--color-surface"])).toBeLessThan(
      luminance(dark["--color-surface-muted"]),
    );
    expect(luminance(dark["--color-surface-muted"])).toBeLessThan(
      luminance(dark["--color-surface-raised"]),
    );
  });

  it("uses selected-history green for both action palettes", () => {
    expect(light["--color-action"]).toBe("#d9e9e6");
    expect(light["--color-action-hover"]).toBe("#cfe2de");
    expect(light["--color-action-foreground"]).toBe("#000000");
    expect(dark["--color-action"]).toBe("#223630");
    expect(dark["--color-action-hover"]).toBe("#2a443d");
    expect(dark["--color-action-foreground"]).toBe("#ffffff");
    expect(light["--color-brand-soft-foreground"]).toBe("#000000");
    expect(dark["--color-brand-soft-foreground"]).toBe("#ffffff");

    for (const theme of [light, dark]) {
      expect(theme["--color-action"]).toBe(theme["--color-brand-soft"]);
      expect(theme["--button-primary-background"]).toBe("var(--color-action)");
      expect(theme["--button-primary-background-hover"]).toBe(
        "var(--color-action-hover)",
      );
      expect(theme["--button-primary-foreground"]).toBe(
        "var(--color-action-foreground)",
      );
      expect(theme["--segmented-control-active-surface"]).toBe(
        "var(--color-brand-soft)",
      );

      expect(
        contrast(theme["--color-action-foreground"], theme["--color-action"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(theme["--color-brand-soft-foreground"], theme["--color-brand-soft"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(theme["--color-foreground"], theme["--color-background"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(theme["--color-muted-foreground"], theme["--color-background"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("hides only dark-mode green borders and keeps the split divider", () => {
    expect(light["--color-brand-border"]).toBe("#789a93");
    expect(light["--selected-item-border"]).not.toBe("transparent");
    expect(dark["--color-brand-border"]).toBe("transparent");
    expect(dark["--selected-item-border"]).toBe("transparent");
    expect(light["--commit-action-divider"]).toBe("var(--selected-item-border)");
    expect(dark["--commit-action-divider"]).toBe("rgb(255 255 255 / 0.26)");
    expect(dark["--color-border"]).not.toBe("transparent");

    const runtime = css.slice(
      css.indexOf(".runtime-settings__split {"),
      css.indexOf(".runtime-settings__action-menu {"),
    );
    expect(runtime).toContain("box-shadow: inset 0 0 0 1px var(--selected-item-border)");
    expect(runtime.match(/border-left: 1px solid var\(--commit-action-divider\)/g)).toHaveLength(2);
    expect(runtime).not.toMatch(/rgb\(255 255 255 \/ 15%\)/);

    expect(css).toMatch(/\.navigation-item\.is-active\s*\{[^}]*var\(--color-brand-soft\)/s);
    expect(css).toMatch(/\.settings-sidebar__item\.is-active\s*\{[^}]*var\(--color-brand-soft\)/s);
  });

  it("keeps every green GGUF badge and selected item readable in both themes", () => {
    const formatBadgeRules = [...css.matchAll(
      /\.downloads-result__meta \.downloads-result__format\s*\{([^}]+)\}/g,
    )];
    expect(formatBadgeRules.length).toBeGreaterThanOrEqual(2);
    const finalFormatRule = formatBadgeRules.at(-1)?.[1] ?? "";
    expect(finalFormatRule).toContain("color: var(--color-brand-soft-foreground)");
    expect(finalFormatRule).toContain("background: var(--color-brand-soft)");

    for (const selector of [
      ".download-option-card__copy .download-option-card__format",
      ".download-summary-card__capabilities span",
      ".navigation-item.is-active",
      ".settings-sidebar__item.is-active",
      ".ui-dropdown__option[aria-selected=\"true\"]",
      ".ui-dropdown__badge",
    ]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
      expect(match?.[1], `${selector} must explicitly define text color`).toContain(
        "color: var(--color-brand-soft-foreground)",
      );
    }
    for (const theme of [light, dark]) {
      expect(
        contrast(theme["--color-brand-soft-foreground"], theme["--color-brand-soft"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("styles both checked and unchecked switches without Tailwind utilities", () => {
    expect(switchSource).toContain("['tide-switch', className]");
    expect(switchSource).not.toContain("bg-brand");
    expect(switchSource).not.toContain("bg-border");
    expect(switchSource).not.toContain("bg-white");

    expect(css).toMatch(/\.tide-switch\[aria-checked="true"\]\s*\{[^}]*var\(--switch-on-track\)/s);
    expect(css).toMatch(/\.tide-switch\[aria-checked="true"\] > span\s*\{[^}]*var\(--switch-on-thumb\)/s);
    for (const theme of [light, dark]) {
      expect(theme["--switch-on-track"]).toBe("var(--color-action)");
      expect(theme["--switch-on-thumb"]).toBe("var(--color-action-foreground)");
      expect(theme["--switch-off-thumb"]).toBe("#ffffff");
      expect(contrast(theme["--switch-off-track"], theme["--color-surface"])).toBeGreaterThanOrEqual(3);
      expect(contrast(theme["--switch-off-thumb"], theme["--switch-off-track"])).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps status/progress colors separate from the selected-state accent", () => {
    for (const theme of [light, dark]) {
      expect(theme["--color-success-foreground"]).not.toBe(theme["--color-action"]);
      expect(theme["--color-danger-foreground"]).not.toBe(theme["--color-action"]);
      expect(theme["--color-progress-fill"]).not.toBe(theme["--color-action"]);
      expect(
        contrast(theme["--color-progress-foreground"], theme["--color-progress-fill"]),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toContain("background: var(--color-progress-fill);");
    expect(css).toContain("background: var(--color-success-surface);");
    expect(css).toContain("background: var(--color-overlay-backdrop);");
  });

  it("propagates resolved light/dark/system appearance to the tray and window", () => {
    expect(appearanceSource).toContain('emit("tidestudio:appearance", { appearance, dark })');
    expect(appearanceSource).toContain('meta[name="theme-color"]');
    expect(traySource).toContain('listen<AppearanceChange>("tidestudio:appearance"');
    expect(traySource).toContain('get_ui_preference');
    expect(traySource).toContain('systemDark.addEventListener("change", applyAppearance)');
    expect(trayCss).toContain(':root[data-theme="dark"]');
    expect(trayCss).toContain('#171718');
  });

  it("preserves the original compact model-memory layout", () => {
    expect(css).toMatch(/\.load-model-settings__memory-card\s*\{[^}]*display: flex;/s);
    expect(css).toMatch(/\.load-model-settings__memory-card\s*\{[^}]*justify-content: space-between;/s);
    expect(css).not.toContain(".load-model-settings__memory-breakdown");
    expect(css).not.toContain(".load-model-settings__memory-note");
  });

  it("keeps the Load Model back button's hover identical to the close button", () => {
    expect(loadModelDialogSource).toContain('className="ui-modal__close load-model-settings__back"');
    expect(css).toMatch(/\.load-model-dialog \.ui-modal__close\s*\{[^}]*width: 26px;[^}]*height: 26px;/s);
    expect(css).toMatch(/\.ui-icon-button:hover:not\(:disabled\)\s*\{[^}]*background: var\(--color-surface-muted\);/s);
    expect(css).not.toContain(".load-model-settings__back.ui-icon-button");
  });
});
