import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  Plus,
  Settings2,
  Square,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
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
  pendingModelPaths: string[];
  logs: string[];
  selectedPort: number | null;
  allModels: CatalogModel[];
  configs: Record<string, ModelConfig>;
  serverSettings: ServerSettings;
  gatewayRunning: boolean;
  onSelectServer: (port: number) => void;
  onStop: (port: number) => Promise<void>;
  onLoadModel: (model: CatalogModel) => Promise<void>;
  onServerSettingsChange: (settings: ServerSettings) => void;
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function formatMemory(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Measuring…";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit >= 3 ? 2 : 1)} ${units[unit]}`;
}

export function ServerDashboard({
  servers,
  pendingModelPaths,
  logs,
  selectedPort,
  allModels,
  configs,
  serverSettings,
  gatewayRunning,
  onSelectServer,
  onStop,
  onLoadModel,
  onServerSettingsChange,
}: Props) {
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const {
    containerRef,
    collapsed,
    panelHeight,
    beginResize,
    toggleCollapsed,
  } = useResizableLogsPanel();

  const runningServers = servers.filter((server) => server.running);
  const pendingModels = allModels.filter(
    (model) =>
      pendingModelPaths.includes(model.path) &&
      !runningServers.some((server) => server.modelPath === model.path),
  );
  const selectedServer =
    runningServers.find((server) => server.port === selectedPort) ?? null;
  const loadedModels = allModels.filter(
    (model) =>
      pendingModelPaths.includes(model.path) ||
      runningServers.some((server) => server.modelPath === model.path),
  );
  const reachableEndpoint = "http://localhost:" + serverSettings.port;

  function copyWithFeedback(value: string, target: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedTarget(target);
      window.setTimeout(() => {
        setCopiedTarget((current) => (current === target ? null : current));
      }, 1400);
    });
  }

  function copyEndpoint() {
    copyWithFeedback(reachableEndpoint, "endpoint");
  }

  async function stopModel(modelId: string) {
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
      <header className="server-page-header">
        <div className="server-page-header__identity">
          <h1>Server</h1>
          <div className="server-page-header__status">
            <span
              className={
                gatewayRunning
                  ? "server-status-dot is-running"
                  : "server-status-dot"
              }
              aria-hidden="true"
            />
            <span>{gatewayRunning ? "API running" : "API stopped"}</span>
            <code>{reachableEndpoint}</code>
            <IconButton
              className="server-page-header__copy"
              icon={copiedTarget === "endpoint" ? Check : Copy}
              label={
                copiedTarget === "endpoint"
                  ? "Server endpoint copied"
                  : "Copy server endpoint"
              }
              size={13}
              onClick={copyEndpoint}
            />
          </div>
        </div>

        <div className="server-page-header__actions">
          <Button
            variant="secondary"
            size="compact"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings2 size={13} strokeWidth={2} aria-hidden="true" />
            Settings
          </Button>
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
      </header>

      <div className="running-model-region">
        <div className="running-model-region__heading">
          <h3>Loaded Models</h3>
          <span>{runningServers.length + pendingModels.length}</span>
        </div>

        <div className="running-model-stack">
          {runningServers.length === 0 && pendingModels.length === 0 ? (
            <div className="server-empty-state">
              No models are currently loaded.
              {allModels.length > 0
                ? " Use Load Model to start a local GGUF."
                : " Download or add a GGUF model first."}
            </div>
          ) : (
            <>
              {pendingModels.map((model) => (
                <article
                  className="running-model-card running-model-card--pending"
                  key={`pending-${model.path}`}
                >
                  <div className="running-model-card__top">
                    <span className="running-model-card__state is-loading">
                      Loading
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="running-model-card__bottom">
                    <div className="running-model-card__identity-group">
                      <span className="running-model-card__model-type">
                        {model.category}
                      </span>
                      <span className="running-model-card__model-name-badge">
                        <strong className="running-model-card__model-name">
                          {model.name}
                        </strong>
                      </span>
                      {model.quantization && model.quantization !== "Unknown" ? (
                        <span className="running-model-card__capability">
                          {model.quantization}
                        </span>
                      ) : null}
                      {model.supportsMtp ? (
                        <span className="running-model-card__capability">
                          MTP
                        </span>
                      ) : null}
                      {model.supportsVision ? (
                        <span
                          className="running-model-card__capability running-model-card__capability--vision"
                          title="Vision capable"
                          aria-label="Vision capable"
                        >
                          <Eye size={13} strokeWidth={1.9} aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>

                    <div className="running-model-card__actions">
                      <span className="running-model-card__memory">
                        <span>RAM</span>
                        <strong>Starting…</strong>
                      </span>
                      <Button
                        className="running-model-card__stop"
                        variant="danger"
                        size="compact"
                        disabled
                      >
                        <Square size={12} strokeWidth={2} aria-hidden="true" />
                        Stop
                      </Button>
                    </div>
                  </div>
                </article>
              ))}

              {runningServers.map((server) => {
                const model = allModels.find(
                  (candidate) => candidate.path === server.modelPath,
                );
                const modelName =
                  model?.name || server.modelName || fileName(server.modelPath);
                const quantization = model?.quantization || server.quantization;
                const supportsMtp = model?.supportsMtp ?? server.supportsMtp;
                const supportsVision =
                  model?.supportsVision ?? server.supportsVision;
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
                    className="running-model-card__top"
                    type="button"
                    onClick={() => onSelectServer(server.port)}
                  >
                    <span
                      className={
                        server.state === "loading"
                          ? "running-model-card__state is-loading"
                          : "running-model-card__state"
                      }
                    >
                      {server.state === "loading" ? "Loading" : "Ready"}
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>

                  <div className="running-model-card__bottom">
                    <div className="running-model-card__identity-group">
                      <span className="running-model-card__model-type">
                        {model?.category ?? server.modelCategory}
                      </span>
                      <button
                        className="running-model-card__model-name-badge"
                        type="button"
                        onClick={() => onSelectServer(server.port)}
                      >
                        <strong className="running-model-card__model-name">
                          {modelName}
                        </strong>
                      </button>
                      {quantization && quantization !== "Unknown" ? (
                        <span className="running-model-card__capability">
                          {quantization}
                        </span>
                      ) : null}
                      {supportsMtp ? (
                        <span className="running-model-card__capability">
                          MTP
                        </span>
                      ) : null}
                      {supportsVision ? (
                        <span
                          className="running-model-card__capability running-model-card__capability--vision"
                          title="Vision capable"
                          aria-label="Vision capable"
                        >
                          <Eye size={13} strokeWidth={1.9} aria-hidden="true" />
                        </span>
                      ) : null}
                      <IconButton
                        className="running-model-card__model-copy"
                        icon={
                          copiedTarget === `model:${server.port}` ? Check : Copy
                        }
                        label={
                          copiedTarget === `model:${server.port}`
                            ? "API model ID copied"
                            : "Copy API model ID"
                        }
                        size={12}
                        onClick={() =>
                          copyWithFeedback(
                            server.modelId,
                            `model:${server.port}`,
                          )
                        }
                      />
                    </div>

                    <div className="running-model-card__actions">
                      <span className="running-model-card__memory">
                        <span>RAM</span>
                        <strong>{formatMemory(server.memoryBytes)}</strong>
                      </span>
                      <Button
                        className="running-model-card__stop"
                        variant="danger"
                        size="compact"
                        onClick={() => void onStop(server.port)}
                      >
                        <Square size={12} strokeWidth={2} aria-hidden="true" />
                        Stop
                      </Button>
                    </div>
                  </div>
                </article>
                );
              })}
            </>
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
        pendingModelPaths={pendingModelPaths}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={(model) => void onLoadModel(model)}
        onStop={(modelId) => void stopModel(modelId)}
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
