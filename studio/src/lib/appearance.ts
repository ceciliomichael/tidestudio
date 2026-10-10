import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getUiPreference, setUiPreference } from "./tauri";

export type AppAppearance = "light" | "dark" | "system";
export type AppLanguage = "en-US" | "en-GB" | "fil-PH";

const APPEARANCE_KEY = "app.appearance.v1";
const LANGUAGE_KEY = "app.language.v1";

function isAppearance(value: string | null): value is AppAppearance {
  return value === "light" || value === "dark" || value === "system";
}

function isLanguage(value: string | null): value is AppLanguage {
  return value === "en-US" || value === "en-GB" || value === "fil-PH";
}

export function useAppearancePreferences() {
  const [appearance, setAppearance] = useState<AppAppearance>("system");
  const [language, setLanguage] = useState<AppLanguage>("en-US");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getUiPreference(APPEARANCE_KEY), getUiPreference(LANGUAGE_KEY)])
      .then(([storedAppearance, storedLanguage]) => {
        if (cancelled) return;
        if (isAppearance(storedAppearance)) setAppearance(storedAppearance);
        if (isLanguage(storedLanguage)) setLanguage(storedLanguage);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function applyTheme() {
      const dark = appearance === "dark" || (appearance === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";

      if (isTauri()) {
        const nativeWindow = getCurrentWindow();
        const color = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-sidebar")
          .trim();
        void (async () => {
          await nativeWindow.setTheme(
            appearance === "system" ? null : dark ? "dark" : "light",
          );
          await Promise.all([
            nativeWindow.setBackgroundColor(color),
            invoke("set_native_caption_color", { color, dark }),
          ]);
        })().catch(console.error);
      }
    }
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [appearance]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function changeAppearance(value: AppAppearance) {
    if (!ready) return;
    setAppearance(value);
    void setUiPreference(APPEARANCE_KEY, value).catch(console.error);
  }

  function changeLanguage(value: AppLanguage) {
    if (!ready) return;
    setLanguage(value);
    void setUiPreference(LANGUAGE_KEY, value).catch(console.error);
  }

  return { appearance, language, changeAppearance, changeLanguage };
}
