import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const DEFAULT_LOG_HEIGHT = 280;
const MIN_LOG_HEIGHT = 160;
const MIN_MODEL_REGION_HEIGHT = 170;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function bounds(containerHeight: number) {
  const maximum = Math.max(96, containerHeight - MIN_MODEL_REGION_HEIGHT);
  const minimum = Math.min(MIN_LOG_HEIGHT, maximum);

  return { minimum, maximum };
}

export function useResizableLogsPanel() {
  const containerRef = useRef<HTMLElement>(null);
  const [expandedHeight, setExpandedHeight] = useState(DEFAULT_LOG_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const fit = () => {
      const containerHeight = container.getBoundingClientRect().height;
      const { minimum, maximum } = bounds(containerHeight);

      setExpandedHeight((current) => clamp(current, minimum, maximum));
    };

    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const beginResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;

      if (!container || collapsed) {
        return;
      }

      event.preventDefault();

      const startY = event.clientY;
      const startHeight = expandedHeight;
      const containerHeight = container.getBoundingClientRect().height;
      const { minimum, maximum } = bounds(containerHeight);

      document.body.classList.add("is-resizing-logs");

      function move(pointerEvent: PointerEvent) {
        const delta = pointerEvent.clientY - startY;
        setExpandedHeight(clamp(startHeight - delta, minimum, maximum));
      }

      function finish() {
        document.body.classList.remove("is-resizing-logs");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [collapsed, expandedHeight],
  );

  return {
    containerRef,
    collapsed,
    panelHeight: expandedHeight,
    beginResize,
    toggleCollapsed: () => setCollapsed((current) => !current),
  };
}
