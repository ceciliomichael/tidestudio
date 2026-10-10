import { ChevronDown, TerminalSquare } from "lucide-react";
import type { CSSProperties } from "react";
import type { ServerStatus } from "../../lib/tauri";

type Props = {
  server: ServerStatus | null;
  logs: string[];
  collapsed: boolean;
  height: number;
  onToggleCollapsed: () => void;
};

export function ServerLogsPanel({
  server,
  logs,
  collapsed,
  height,
  onToggleCollapsed,
}: Props) {
  const output = server
    ? logs.length > 0
      ? logs.join("\n")
      : "llama-server output will appear here."
    : "No running model selected.";

  const style: CSSProperties = {
    flexBasis: collapsed ? 48 : height,
  };

  return (
    <section
      className={
        collapsed
          ? "server-logs-panel is-collapsed"
          : "server-logs-panel"
      }
      style={style}
    >
      <button
        className="server-logs-panel__header"
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <span>
          <span className="server-logs-panel__title">
            <TerminalSquare size={15} strokeWidth={1.9} aria-hidden="true" />
            <strong>API Logs</strong>
          </span>
        </span>

        <ChevronDown
          className={
            collapsed
              ? "server-logs-panel__chevron"
              : "server-logs-panel__chevron is-open"
          }
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </button>

      {!collapsed ? (
        <pre className="server-logs-panel__output">{output}</pre>
      ) : null}
    </section>
  );
}
