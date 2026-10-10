import type { CSSProperties, ReactNode } from "react";
import {
  useResizablePanels,
  type WorkspaceLayoutMode,
} from "./useResizablePanels";

type Props = {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  layoutMode?: WorkspaceLayoutMode;
};

export function ResizableWorkspace({
  left,
  main,
  right,
  layoutMode = "standard",
}: Props) {
  const {
    containerRef,
    leftWidth,
    rightWidth,
    beginLeftResize,
    beginRightResize,
  } = useResizablePanels(layoutMode);

  const noRightPanel = layoutMode === "modelSearchBrowse" || layoutMode === "settings";
  const fallback =
    noRightPanel
      ? "220px 0 minmax(0, 1fr) 0 0"
      : layoutMode === "modelSearchDetail"
        ? "220px 0 minmax(360px, 42%) 0 minmax(480px, 58%)"
        : "220px 0 minmax(0, 1fr) 0 320px";

  const style: CSSProperties = {
    gridTemplateColumns:
      leftWidth === null || rightWidth === null
        ? fallback
        : `${leftWidth}px 0 minmax(0, 1fr) 0 ${rightWidth}px`,
  };

  return (
    <div
      className={[
        "workspace",
        layoutMode === "modelSearchDetail"
          ? "workspace--model-search-detail"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={containerRef}
      style={style}
    >
      {left}
      <div
        className="panel-resizer"
        role="separator"
        aria-label="Resize navigation panel"
        aria-orientation="vertical"
        onPointerDown={beginLeftResize}
      />
      {main}
        {noRightPanel ? null : (
        <div
          className="panel-resizer"
          role="separator"
          aria-label="Resize configuration panel"
          aria-orientation="vertical"
          onPointerDown={beginRightResize}
        />
      )}
      {right}
    </div>
  );
}
