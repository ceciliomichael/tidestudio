import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, Server } from "lucide-react";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ModelLibrary } from "../features/models/ModelLibrary";
import { ModelSettings } from "../features/models/ModelSettings";
import { ServerDashboard } from "../features/server/ServerDashboard";
import { ServerInspector } from "../features/server/ServerInspector";
import {
  listModels,
  listServers,
  serverLogs,
  startServer,
  stopServer,
  type ModelInfo,
  type ServerConfig,
  type ServerStatus,
} from "../lib/tauri";
import {
  NavigationPanel,
  type ActivePage,
} from "./NavigationPanel";
import { ResizableWorkspace } from "./ResizableWorkspace";

function createDefaultConfig(modelPath: string, index: number): ServerConfig {
  return {
    modelPath,
    host: "127.0.0.1",
    port: 8080 + index,
    contextSize: 32768,
    gpuLayers: 99,
    temperature: 0.8,
    flashAttention: true,
    extraArgs: [],
  };
}

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>("server");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [configs, setConfigs] = useState<Record<string, ServerConfig>>({});
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [selectedServerPort, setSelectedServerPort] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.path === selectedPath) ?? null,
    [models, selectedPath],
  );

  const selectedConfig = selectedModel ? configs[selectedModel.path] ?? null : null;

  const selectedServer = useMemo(
    () =>
      servers.find((server) => server.port === selectedServerPort) ?? null,
    [selectedServerPort, servers],
  );

  const runningServers = useMemo(
    () => servers.filter((server) => server.running),
    [servers],
  );

  useEffect(() => {
    void refreshModels();
    void refreshServers();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshServers();
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activePage !== "server" || selectedServerPort === null) {
      setLogs([]);
      return;
    }

    void refreshLogs(selectedServerPort);
    const timer = window.setInterval(() => {
      void refreshLogs(selectedServerPort);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activePage, selectedServerPort]);

  async function refreshModels() {
    try {
      const discovered = await listModels();

      setModels(discovered);
      setSelectedPath((current) => current || discovered[0]?.path || "");
      setConfigs((current) => {
        const next = { ...current };

        discovered.forEach((model, index) => {
          if (!next[model.path]) {
            next[model.path] = createDefaultConfig(model.path, index);
          }
        });

        return next;
      });
      setError(null);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function refreshServers() {
    try {
      const nextServers = await listServers();

      setServers(nextServers);
      setSelectedServerPort((current) => {
        if (current !== null && nextServers.some((server) => server.port === current)) {
          return current;
        }

        return nextServers[0]?.port ?? null;
      });
      setError(null);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function refreshLogs(port: number) {
    try {
      setLogs(await serverLogs(port));
    } catch (cause) {
      setError(String(cause));
    }
  }

  function handleConfigChange(config: ServerConfig) {
    setConfigs((current) => ({
      ...current,
      [config.modelPath]: config,
    }));
  }

  async function handleStart(config: ServerConfig) {
    try {
      const status = await startServer(config);

      setSelectedServerPort(status.port);
      setActivePage("server");
      setError(null);
      await refreshServers();
      await refreshLogs(status.port);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function handleStop(port: number) {
    try {
      await stopServer(port);
      setLogs([]);
      setError(null);
      await refreshServers();
    } catch (cause) {
      setError(String(cause));
    }
  }

  const statusLabel =
    runningServers.length === 0
      ? "Server stopped"
      : runningServers.length === 1
        ? `1 server running · localhost:${runningServers[0].port}`
        : `${runningServers.length} servers running`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Boxes size={17} strokeWidth={2} />
          </div>
          <div className="brand-copy">
            <h1>TideStudio</h1>
            <p>Local inference workspace</p>
          </div>
        </div>

        <StatusBadge
          icon={runningServers.length > 0 ? Activity : Server}
          label={statusLabel}
          tone={runningServers.length > 0 ? "success" : "neutral"}
        />
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <ResizableWorkspace
        left={
          <NavigationPanel
            activePage={activePage}
            onPageChange={setActivePage}
          />
        }
        main={
          <section className="main-panel">
            {activePage === "server" ? (
              <ServerDashboard
                models={models}
                configs={configs}
                servers={servers}
                selectedPort={selectedServerPort}
                onSelectServer={setSelectedServerPort}
                onStart={handleStart}
                onStop={handleStop}
              />
            ) : (
              <ModelLibrary
                models={models}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                onRefresh={() => void refreshModels()}
              />
            )}
          </section>
        }
        right={
          <aside className="inspector-panel">
            {activePage === "server" ? (
              <ServerInspector
                server={selectedServer}
                logs={logs}
                onStop={handleStop}
              />
            ) : (
              <ModelSettings
                selectedModel={selectedModel}
                config={selectedConfig}
                onChange={handleConfigChange}
              />
            )}
          </aside>
        }
      />
    </main>
  );
}
