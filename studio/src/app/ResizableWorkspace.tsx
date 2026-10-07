import type { CSSProperties, ReactNode } from "react";
import { useResizablePanels } from "./useResizablePanels";

type Props = {
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
};

export function ResizableWorkspace({ left, main, right }: Props) {
  const {
    containerRef,
    leftWidth,
    rightWidth,
    beginLeftResize,
    beginRightResize,
  } = useResizablePanels();

  const style: CSSProperties = {
    gridTemplateColumns:
      leftWidth === null || rightWidth === null
        ? "20% 0 minmax(0, 1fr) 0 20%"
        : `${leftWidth}px 0 minmax(0, 1fr) 0 ${rightWidth}px`,
  };

  return (
    <div className="workspace" ref={containerRef} style={style}>
      {left}
      <div
        className="panel-resizer"
        role="separator"
        aria-label="Resize navigation panel"
        aria-orientation="vertical"
        onPointerDown={beginLeftResize}
      />
      {main}
      <div
        className="panel-resizer"
        role="separator"
        aria-label="Resize configuration panel"
        aria-orientation="vertical"
        onPointerDown={beginRightResize}
      />
      {right}
    </div>
  );
}
