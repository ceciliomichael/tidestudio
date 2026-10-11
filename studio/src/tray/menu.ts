import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./menu.css";

const menu = document.querySelector<HTMLElement>(".menu")!;
const toggle = document.getElementById("toggle")!;
const quit = document.getElementById("quit")!;

async function initializeVisibility() {
  await listen<boolean>("tray-popup-visibility", ({ payload }) => {
    menu.dataset.visible = payload ? "true" : "false";
  });
  const visible = await invoke<boolean>("tray_popup_visible");
  menu.dataset.visible = visible ? "true" : "false";
}

void initializeVisibility().catch(console.error);

toggle.addEventListener("click", (event) => {
  event.preventDefault();
  void invoke("toggle_window").catch(console.error);
});

quit.addEventListener("click", (event) => {
  event.preventDefault();
  void invoke("quit_app").catch(console.error);
});
