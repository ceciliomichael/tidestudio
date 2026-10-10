import { LogicalSize } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";

const PREFERRED_MIN_WINDOW_WIDTH = 1100;
const PREFERRED_MIN_WINDOW_HEIGHT = 700;
const DISPLAY_EDGE_MARGIN = 24;

async function syncMinimumWindowSize() {
  const monitor = await currentMonitor();
  if (!monitor) {
    return;
  }

  const workArea = monitor.workArea.size.toLogical(monitor.scaleFactor);
  const availableWidth = Math.max(
    320,
    Math.floor(workArea.width - DISPLAY_EDGE_MARGIN),
  );
  const availableHeight = Math.max(
    240,
    Math.floor(workArea.height - DISPLAY_EDGE_MARGIN),
  );
  const minWidth = Math.min(PREFERRED_MIN_WINDOW_WIDTH, availableWidth);
  const minHeight = Math.min(PREFERRED_MIN_WINDOW_HEIGHT, availableHeight);

  await getCurrentWindow().setMinSize(new LogicalSize(minWidth, minHeight));
}

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

void syncMinimumWindowSize().catch(() => undefined);
void getCurrentWindow().onMoved(() => {
  void syncMinimumWindowSize().catch(() => undefined);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
