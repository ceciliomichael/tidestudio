import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WorkspacePanelPreferences } from "./workspacePanelPreferences";

const MIN_LEFT_WIDTH = 196;
const MAX_LEFT_WIDTH = 380;
const STANDARD_MIN_RIGHT_WIDTH = 260;
const STANDARD_MAX_RIGHT_WIDTH = 440;
const DETAIL_MIN_RIGHT_WIDTH = 480;
const DETAIL_MAX_RIGHT_WIDTH = 1100;
const STANDARD_MIN_MAIN_WIDTH = 500;
const DETAIL_MIN_MAIN_WIDTH = 360;
const HANDLE_LAYOUT_WIDTH = 0;

export type WorkspaceLayoutMode =
  | "standard"
  | "settings"
  | "downloadActivity"
  | "modelSearchBrowse"
  | "modelSearchDetail";

type ResizeSide = "left" | "right";

type PanelWidths = {
  left: number;
  right: number;
};

type LayoutLimits = {
  minRight: number;
  maxRight: number;
  minMain: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function limitsFor(mode: WorkspaceLayoutMode): LayoutLimits {
  if (mode === "modelSearchBrowse" || mode === "settings" || mode === "downloadActivity") {
    return {
      minRight: 0,
      maxRight: 0,
      minMain: STANDARD_MIN_MAIN_WIDTH,
    };
  }

  if (mode === "modelSearchDetail") {
    return {
      minRight: DETAIL_MIN_RIGHT_WIDTH,
      maxRight: DETAIL_MAX_RIGHT_WIDTH,
      minMain: DETAIL_MIN_MAIN_WIDTH,
    };
  }

  return {
    minRight: STANDARD_MIN_RIGHT_WIDTH,
    maxRight: STANDARD_MAX_RIGHT_WIDTH,
    minMain: STANDARD_MIN_MAIN_WIDTH,
  };
}

function initialWidths(
  containerWidth: number,
  mode: WorkspaceLayoutMode,
  preferences?: WorkspacePanelPreferences,
): PanelWidths {
  const left = clamp(preferences?.left ?? 220, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
  const limits = limitsFor(mode);

  if (mode === "modelSearchBrowse" || mode === "settings" || mode === "downloadActivity") {
    return { left, right: 0 };
  }

  if (mode === "modelSearchDetail") {
    const availableAfterNavigation = Math.max(containerWidth - left, 0);

    return {
      left,
      right: clamp(
        preferences?.detailRight ?? availableAfterNavigation * 0.58,
        limits.minRight,
        limits.maxRight,
      ),
    };
  }

  return {
    left,
    right: clamp(
      preferences?.standardRight ?? containerWidth * 0.2,
      limits.minRight,
      limits.maxRight,
    ),
  };
}

function fitToContainer(
  widths: PanelWidths,
  containerWidth: number,
  mode: WorkspaceLayoutMode,
): PanelWidths {
  const limits = limitsFor(mode);
  let left = clamp(widths.left, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);

  if (mode === "modelSearchBrowse" || mode === "settings" || mode === "downloadActivity") {
    return {
      left: Math.min(left, Math.max(MIN_LEFT_WIDTH, containerWidth - limits.minMain)),
      right: 0,
    };
  }

  const effectiveMinRight = Math.min(
    limits.minRight,
    Math.max(
      0,
      containerWidth - MIN_LEFT_WIDTH - limits.minMain,
    ),
  );
  let right = clamp(
    widths.right,
    effectiveMinRight,
    limits.maxRight,
  );
  const availableForSides =
    containerWidth - limits.minMain - HANDLE_LAYOUT_WIDTH * 2;
  let overflow = left + right - availableForSides;

  if (overflow > 0) {
    const rightReduction = Math.min(
      overflow,
      right - effectiveMinRight,
    );
    right -= rightReduction;
    overflow -= rightReduction;
  }

  if (overflow > 0) {
    left -= Math.min(overflow, left - MIN_LEFT_WIDTH);
  }

  return { left, right };
}

export function useResizablePanels(
  mode: WorkspaceLayoutMode,
  initialPreferences: WorkspacePanelPreferences,
  onCommit: (preferences: WorkspacePanelPreferences) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<WorkspacePanelPreferences>({
    ...initialPreferences,
  });
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const [widths, setWidths] = useState<PanelWidths>(() => ({
    left: clamp(initialPreferences.left, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH),
    right:
      mode === "modelSearchBrowse" ||
      mode === "settings" ||
      mode === "downloadActivity"
        ? 0
        : mode === "modelSearchDetail"
          ? clamp(
              initialPreferences.detailRight,
              DETAIL_MIN_RIGHT_WIDTH,
              DETAIL_MAX_RIGHT_WIDTH,
            )
          : clamp(
              initialPreferences.standardRight,
              STANDARD_MIN_RIGHT_WIDTH,
              STANDARD_MAX_RIGHT_WIDTH,
            ),
  }));

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const containerWidth = container.getBoundingClientRect().width;
    setWidths(
      fitToContainer(
        initialWidths(containerWidth, mode, preferencesRef.current),
        containerWidth,
        mode,
      ),
    );

    const observer = new ResizeObserver(() => {
      const nextContainerWidth =
        container.getBoundingClientRect().width;

      setWidths((current) =>
        fitToContainer(
          current,
          nextContainerWidth,
          mode,
        ),
      );
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [mode]);

  const beginResize = useCallback(
    (side: ResizeSide, event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;

      if (!container || mode === "modelSearchBrowse") {
        return;
      }

      event.preventDefault();

      const containerWidth = container.getBoundingClientRect().width;
      const limits = limitsFor(mode);
      const effectiveMinRight = Math.min(
        limits.minRight,
        Math.max(
          0,
          containerWidth - MIN_LEFT_WIDTH - limits.minMain,
        ),
      );
      const startWidths = fitToContainer(
        widths,
        containerWidth,
        mode,
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
              limits.minMain -
              HANDLE_LAYOUT_WIDTH * 2,
          );

          const next = {
            left: clamp(
              startWidths.left + delta,
              MIN_LEFT_WIDTH,
              Math.max(MIN_LEFT_WIDTH, maximum),
            ),
            right: startWidths.right,
          };
          preferencesRef.current.left = next.left;
          setWidths(next);
          return;
        }

        const maximum = Math.min(
          limits.maxRight,
          containerWidth -
            startWidths.left -
            limits.minMain -
            HANDLE_LAYOUT_WIDTH * 2,
        );

        const next = {
          left: startWidths.left,
          right: clamp(
            startWidths.right - delta,
            effectiveMinRight,
            Math.max(effectiveMinRight, maximum),
          ),
        };
        if (mode === "modelSearchDetail") {
          preferencesRef.current.detailRight = next.right;
        } else {
          preferencesRef.current.standardRight = next.right;
        }
        setWidths(next);
      }

      function finish() {
        document.body.classList.remove("is-resizing-panels");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        commitRef.current({ ...preferencesRef.current });
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [mode, widths],
  );

  return {
    containerRef,
    leftWidth: widths.left,
    rightWidth: widths.right,
    beginLeftResize: (event: ReactPointerEvent<HTMLDivElement>) =>
      beginResize("left", event),
    beginRightResize: (event: ReactPointerEvent<HTMLDivElement>) =>
      beginResize("right", event),
  };
}
