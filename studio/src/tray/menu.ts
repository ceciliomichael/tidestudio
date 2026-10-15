import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { APPEARANCE_KEY, type AppAppearance } from "../lib/appearance";
import "./menu.css";

const menu = document.querySelector<HTMLElement>(".menu")!;
const toggle = document.getElementById("toggle")!;
const quit = document.getElementById("quit")!;

type AppearanceChange = { appearance: AppAppearance; dark: boolean };

async function initializeAppearance() {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  let appearance: AppAppearance = "system";
  let updatedFromApp = false;

  function applyAppearance() {
    const dark = appearance === "dark" || (appearance === "system" && systemDark.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  systemDark.addEventListener("change", applyAppearance);
  await listen<AppearanceChange>("tidestudio:appearance", ({ payload }) => {
    updatedFromApp = true;
    appearance = payload.appearance;
    document.documentElement.dataset.theme = payload.dark ? "dark" : "light";
  });

  try {
    const stored = await invoke<string | null>("get_ui_preference", { key: APPEARANCE_KEY });
    if (!updatedFromApp && (stored === "light" || stored === "dark" || stored === "system")) {
      appearance = stored;
    }
  } catch {
    // Tray webviews can start before the preference command becomes available.
  }
  if (!updatedFromApp) {
    applyAppearance();
  }
}

async function initializeVisibility() {
  await listen<boolean>("tray-popup-visibility", ({ payload }) => {
    menu.dataset.visible = payload ? "true" : "false";
  });
  const visible = await invoke<boolean>("tray_popup_visible");
  menu.dataset.visible = visible ? "true" : "false";
}

void initializeVisibility().catch(console.error);
void initializeAppearance().catch(console.error);

toggle.addEventListener("click", (event) => {
  event.preventDefault();
  void invoke("toggle_window").catch(console.error);
});

quit.addEventListener("click", (event) => {
  event.preventDefault();
  void invoke("quit_app").catch(console.error);
});
