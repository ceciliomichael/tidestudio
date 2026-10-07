import { Play, Server, Square } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { SectionHeader } from "../../components/ui/SectionHeader";
import type {
  ModelInfo,
  ServerConfig,
  ServerStatus,
} from "../../lib/tauri";

type Props = {
  models: ModelInfo[];
  configs: Record<string, ServerConfig>;
  servers: ServerStatus[];
  selectedPort: number | null;
  onSelectServer: (port: number) => void;
  onStart: (config: ServerConfig) => Promise<void>;
  onStop: (port: number) => Promise<void>;
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function ServerDashboard({
  models,
  configs,
  servers,
  selectedPort,
  onSelectServer,
  onStart,
  onStop,
}: Props) {
  const runningPorts = new Set(
    servers.filter((server) => server.running).map((server) => server.port),
  );

  return (
    <section className="server-dashboard">
      <SectionHeader
        eyebrow="Server"
        title="Managed servers"
        description="Launch configured models and manage every server started by TideStudio."
        icon={Server}
      />

      <section className="server-section">
        <div className="server-section__heading">
          <div>
            <h3>Launch a model</h3>
            <p>Uses the configuration set from the Models page.</p>
          </div>
        </div>

        {models.length === 0 ? (
          <div className="server-empty">
            Add a GGUF model before starting a server.
          </div>
        ) : (
          <div className="launch-list">
            {models.map((model) => {
              const config = configs[model.path];
              const isRunning = config ? runningPorts.has(config.port) : false;

              return (
                <div className="launch-row" key={model.path}>
                  <div className="launch-row__copy">
                    <strong>{model.name}</strong>
                    <span>
                      {config
                        ? `Port ${config.port} · Context ${config.contextSize ?? "default"}`
                        : "Configuration unavailable"}
                    </span>
                  </div>

                  <Button
                    variant={isRunning ? "secondary" : "primary"}
                    size="compact"
                    disabled={!config || isRunning}
                    onClick={() => config && void onStart(config)}
                  >
                    <Play size={13} strokeWidth={2} aria-hidden="true" />
                    {isRunning ? "Running" : "Start"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="server-section">
        <div className="server-section__heading">
          <div>
            <h3>Active registry</h3>
            <p>Processes currently tracked by TideStudio.</p>
          </div>
          <span className="server-count">{servers.length}</span>
        </div>

        {servers.length === 0 ? (
          <div className="server-empty">
            No managed servers yet.
          </div>
        ) : (
          <div className="managed-server-list">
            {servers.map((server) => (
              <div
                className={
                  selectedPort === server.port
                    ? "managed-server-row is-selected"
                    : "managed-server-row"
                }
                key={server.port}
              >
                <button
                  className="managed-server-row__select"
                  type="button"
                  onClick={() => onSelectServer(server.port)}
                >
                  <div
                    className="server-state-dot"
                    data-running={server.running}
                    aria-hidden="true"
                  />
                  <div className="managed-server-row__copy">
                    <strong>{fileName(server.modelPath)}</strong>
                    <span>
                      localhost:{server.port} · PID {server.pid} · {server.backend}
                    </span>
                  </div>
                  <span className="managed-server-row__state">
                    {server.running ? "Running" : "Stopped"}
                  </span>
                </button>

                {server.running ? (
                  <IconButton
                    className="managed-server-stop"
                    icon={Square}
                    label={`Stop server on port ${server.port}`}
                    size={13}
                    onClick={() => void onStop(server.port)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
