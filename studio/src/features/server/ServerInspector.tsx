import { Square, TerminalSquare } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { SectionHeader } from "../../components/ui/SectionHeader";
import type { ServerStatus } from "../../lib/tauri";

type Props = {
  server: ServerStatus | null;
  logs: string[];
  onStop: (port: number) => Promise<void>;
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function ServerInspector({ server, logs, onStop }: Props) {
  return (
    <section className="settings-section server-inspector">
      <SectionHeader
        eyebrow="Server details"
        title={server ? fileName(server.modelPath) : "No server selected"}
        description={
          server
            ? `${server.backend} on localhost:${server.port}`
            : "Select a managed server to inspect its runtime."
        }
        compact
      />

      {server ? (
        <>
          <div className="server-metadata">
            <div>
              <span>Status</span>
              <strong>{server.running ? "Running" : "Stopped"}</strong>
            </div>
            <div>
              <span>Port</span>
              <strong>{server.port}</strong>
            </div>
            <div>
              <span>PID</span>
              <strong>{server.pid}</strong>
            </div>
          </div>

          <div className="server-log-inspector">
            <div className="server-log-inspector__heading">
              <TerminalSquare size={15} strokeWidth={2} aria-hidden="true" />
              <span>Runtime logs</span>
            </div>
            <pre>
              {logs.length > 0
                ? logs.join("\n")
                : "llama-server output will appear here."}
            </pre>
          </div>

          {server.running ? (
            <div className="inspector-actions">
              <Button
                variant="danger"
                fullWidth
                onClick={() => void onStop(server.port)}
              >
                <Square size={14} strokeWidth={2} aria-hidden="true" />
                Stop server
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="inspector-empty">
          Start or select a server from the center panel.
        </div>
      )}
    </section>
  );
}
