import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 380;
const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 440;
const MIN_MAIN_WIDTH = 350;
const HANDLE_LAYOUT_WIDTH = 0;

type ResizeSide = "left" | "right";

type PanelWidths = {
  left: number;
  right: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function initialWidths(containerWidth: number): PanelWidths {
  return {
    left: clamp(containerWidth * 0.2, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH),
    right: clamp(containerWidth * 0.2, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH),
  };
}

function fitToContainer(widths: PanelWidths, containerWidth: number): PanelWidths {
  let left = clamp(widths.left, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
  let right = clamp(widths.right, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
  const availableForSides =
    containerWidth - MIN_MAIN_WIDTH - HANDLE_LAYOUT_WIDTH * 2;
  let overflow = left + right - availableForSides;

  if (overflow > 0) {
    const rightReduction = Math.min(overflow, right - MIN_RIGHT_WIDTH);
    right -= rightReduction;
    overflow -= rightReduction;
  }

  if (overflow > 0) {
    left -= Math.min(overflow, left - MIN_LEFT_WIDTH);
  }

  return { left, right };
}

export function useResizablePanels() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<PanelWidths | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateForContainer = () => {
      const containerWidth = container.getBoundingClientRect().width;

      setWidths((current) =>
        fitToContainer(current ?? initialWidths(containerWidth), containerWidth),
      );
    };

    updateForContainer();

    const observer = new ResizeObserver(updateForContainer);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const beginResize = useCallback(
    (side: ResizeSide, event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      event.preventDefault();

      const containerWidth = container.getBoundingClientRect().width;
      const startWidths = fitToContainer(
        widths ?? initialWidths(containerWidth),
        containerWidth,
      );
      const startX = event.clientX;

      document.body.classList.add("is-resizing-panels");

      function move(pointerEvent: PointerEvent) {
        const delta = pointerEvent.clientX - startX;

        if (side === "left") {
          const maximum = Math.min(
            MAX_LEFT_WIDTH,
            containerWidth -
              startWidths.right -
              MIN_MAIN_WIDTH -
              HANDLE_LAYOUT_WIDTH * 2,
          );

          setWidths({
            left: clamp(
              startWidths.left + delta,
              MIN_LEFT_WIDTH,
              Math.max(MIN_LEFT_WIDTH, maximum),
            ),
            right: startWidths.right,
          });
          return;
        }

        const maximum = Math.min(
          MAX_RIGHT_WIDTH,
          containerWidth -
            startWidths.left -
            MIN_MAIN_WIDTH -
            HANDLE_LAYOUT_WIDTH * 2,
        );

        setWidths({
          left: startWidths.left,
          right: clamp(
            startWidths.right - delta,
            MIN_RIGHT_WIDTH,
            Math.max(MIN_RIGHT_WIDTH, maximum),
          ),
        });
      }

      function finish() {
        document.body.classList.remove("is-resizing-panels");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [widths],
  );

  return {
    containerRef,
    leftWidth: widths?.left ?? null,
    rightWidth: widths?.right ?? null,
    beginLeftResize: (event: ReactPointerEvent<HTMLDivElement>) =>
      beginResize("left", event),
    beginRightResize: (event: ReactPointerEvent<HTMLDivElement>) =>
      beginResize("right", event),
  };
}
