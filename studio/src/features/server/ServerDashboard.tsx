import {
  Copy,
  FileJson2,
  Plus,
  Settings2,
  Square,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Switch } from "../../components/ui/Switch";
import type {
  ModelConfig,
  ServerSettings,
} from "../../lib/config";
import type { ServerStatus } from "../../lib/tauri";
import type { CatalogModel } from "../models/types";
import { LoadModelDialog } from "./LoadModelDialog";
import { ServerLogsPanel } from "./ServerLogsPanel";
import { ServerSettingsDialog } from "./ServerSettingsDialog";
import { SupportedEndpointsPanel } from "./SupportedEndpointsPanel";
import { useResizableLogsPanel } from "./useResizableLogsPanel";

type Props = {
  servers: ServerStatus[];
  logs: string[];
  selectedPort: number | null;
  allModels: CatalogModel[];
  configs: Record<string, ModelConfig>;
  serverSettings: ServerSettings;
  onSelectServer: (port: number) => void;
  onStop: (port: number) => Promise<void>;
  onLoadModel: (model: CatalogModel) => Promise<void>;
  onServerSettingsChange: (settings: ServerSettings) => void;
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function ServerDashboard({
  servers,
  logs,
  selectedPort,
  allModels,
  configs,
  serverSettings,
  onSelectServer,
  onStop,
  onLoadModel,
  onServerSettingsChange,
}: Props) {
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const {
    containerRef,
    collapsed,
    panelHeight,
    beginResize,
    toggleCollapsed,
  } = useResizableLogsPanel();

  const runningServers = servers.filter((server) => server.running);
  const selectedServer =
    runningServers.find((server) => server.port === selectedPort) ?? null;
  const loadedModels = allModels.filter((model) =>
    runningServers.some((server) => server.modelPath === model.path),
  );
  const reachableEndpoint = selectedServer
    ? "http://localhost:" + selectedServer.port
    : "http://localhost:" + serverSettings.port;

  function copyEndpoint() {
    void navigator.clipboard.writeText(reachableEndpoint);
  }

  async function ejectModel(modelId: string) {
    const model = allModels.find((candidate) => candidate.id === modelId);
    if (!model) {
      return;
    }

    const server = runningServers.find(
      (candidate) => candidate.modelPath === model.path,
    );
    if (server) {
      await onStop(server.port);
    }
  }

  return (
    <section
      className="server-dashboard server-dashboard--runtime"
      ref={containerRef}
    >
      <div className="server-toolbar-shell">
        <div className="server-toolbar">
          <div className="server-toolbar__left">
            <div className="server-toolbar__status">
              <span>Status: {runningServers.length > 0 ? "Running" : "Stopped"}</span>
              <Switch
                className="tide-switch"
                checked={runningServers.length > 0}
                disabled
                label="Server status"
                onChange={() => undefined}
              />
            </div>

            <Button
              className="server-toolbar__button"
              variant="secondary"
              size="compact"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings2 size={13} strokeWidth={2} aria-hidden="true" />
              Server Settings
            </Button>

            <Button
              className="server-toolbar__button"
              variant="secondary"
              size="compact"
              disabled
            >
              <FileJson2 size={13} strokeWidth={2} aria-hidden="true" />
              mcp.json
            </Button>
          </div>

          <div className="server-toolbar__right">
            <span className="server-toolbar__reachable">Reachable at:</span>
            <code className="server-toolbar__endpoint">{reachableEndpoint}</code>
            <IconButton
              className="server-toolbar__copy"
              icon={Copy}
              label="Copy server endpoint"
              size={14}
              onClick={copyEndpoint}
            />
            <Button
              variant="primary"
              size="compact"
              disabled={allModels.length === 0}
              onClick={() => setLoadDialogOpen(true)}
            >
              <Plus size={13} strokeWidth={2} aria-hidden="true" />
              Load Model
            </Button>
          </div>
        </div>
      </div>

      <div className="running-model-region">
        <div className="running-model-region__heading">
          <h3>Loaded Models</h3>
          <span>{runningServers.length}</span>
        </div>

        <div className="running-model-stack">
          {runningServers.length === 0 ? (
            <div className="server-empty-state">
              No models are currently loaded.
              {allModels.length > 0
                ? " Use Load Model to start a local GGUF."
                : " Download or add a GGUF model first."}
            </div>
          ) : (
            runningServers.map((server) => {
              const model = allModels.find(
                (candidate) => candidate.path === server.modelPath,
              );
              const config = configs[server.modelPath];

              return (
                <article
                  className={
                    selectedPort === server.port
                      ? "running-model-card is-selected"
                      : "running-model-card"
                  }
                  key={server.port}
                >
                  <button
                    className="running-model-card__select"
                    type="button"
                    onClick={() => onSelectServer(server.port)}
                  >
                    <span
                      className="server-state-dot"
                      data-running="true"
                      aria-hidden="true"
                    />
                    <span className="running-model-card__copy">
                      <strong>{model?.name ?? fileName(server.modelPath)}</strong>
                      <span>
                        Context {config?.contextSize ?? "Default"}
                        {model
                          ? " · " + model.quantization + " · " + model.category
                          : ""}
                        {" · localhost:" + server.port + " · PID " + server.pid}
                      </span>
                    </span>
                  </button>

                  <div className="running-model-card__actions">
                    <span className="running-model-card__state">Running</span>
                    <Button
                      variant="danger"
                      size="compact"
                      onClick={() => void onStop(server.port)}
                    >
                      <Square size={12} strokeWidth={2} aria-hidden="true" />
                      Stop
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <SupportedEndpointsPanel />
      </div>

      {!collapsed ? (
        <div
          className="server-logs-resizer"
          role="separator"
          aria-label="Resize API logs panel"
          aria-orientation="horizontal"
          onPointerDown={beginResize}
        />
      ) : null}

      <ServerLogsPanel
        server={selectedServer}
        logs={logs}
        collapsed={collapsed}
        height={panelHeight}
        onToggleCollapsed={toggleCollapsed}
      />

      <LoadModelDialog
        open={loadDialogOpen}
        allModels={allModels}
        loadedModels={loadedModels}
        configs={configs}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={(model) => void onLoadModel(model)}
        onEject={(modelId) => void ejectModel(modelId)}
      />

      <ServerSettingsDialog
        open={settingsDialogOpen}
        settings={serverSettings}
        onClose={() => setSettingsDialogOpen(false)}
        onChange={onServerSettingsChange}
      />
    </section>
  );
}
