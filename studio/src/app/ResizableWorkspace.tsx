import type { CSSProperties, ReactNode } from "react";
import {
  useResizablePanels,
  type WorkspaceLayoutMode,
} from "./useResizablePanels";
import type { WorkspacePanelPreferences } from "./workspacePanelPreferences";

type Props = {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  layoutMode?: WorkspaceLayoutMode;
  initialPanelPreferences: WorkspacePanelPreferences;
  onPanelPreferencesChange: (preferences: WorkspacePanelPreferences) => void;
};

export function ResizableWorkspace({
  left,
  main,
  right,
  layoutMode = "standard",
  initialPanelPreferences,
  onPanelPreferencesChange,
}: Props) {
  const {
    containerRef,
    leftWidth,
    rightWidth,
    beginLeftResize,
    beginRightResize,
  } = useResizablePanels(
    layoutMode,
    initialPanelPreferences,
    onPanelPreferencesChange,
  );

  const noRightPanel = layoutMode === "modelSearchBrowse" || layoutMode === "settings" || layoutMode === "downloadActivity";
  const style: CSSProperties = {
    gridTemplateColumns: `${leftWidth}px 0 minmax(0, 1fr) 0 ${rightWidth}px`,
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
