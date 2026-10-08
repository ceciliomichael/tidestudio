import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Boxes, Download, Server } from "lucide-react";
import { IconButton } from "../components/ui/IconButton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DownloadActivityPopover } from "../features/downloads/DownloadActivityPopover";
import { DownloadInspector } from "../features/downloads/DownloadInspector";
import { DownloadsBrowser } from "../features/downloads/DownloadsBrowser";
import type {
  DownloadActivity,
  DownloadProgress,
  DownloadedModel,
  HuggingFaceFile,
  HuggingFaceModelSummary,
  HuggingFaceRepoDetails,
} from "../features/downloads/types";
import { ModelLibrary } from "../features/models/ModelLibrary";
import { ModelInspector } from "../features/models/ModelInspector";
import type { CatalogModel } from "../features/models/types";
import { ServerDashboard } from "../features/server/ServerDashboard";
import {
  createDefaultModelConfig,
  createDefaultServerSettings,
  type ModelConfig,
} from "../lib/config";
import {
  downloadHuggingFaceFile,
  huggingFaceModelFiles,
  listModels,
  listServers,
  searchHuggingFaceModels,
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

function formatModelSize(sizeBytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = sizeBytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatModified(modifiedMs: number | null) {
  if (modifiedMs === null) {
    return "Unknown";
  }

  return new Date(modifiedMs).toLocaleDateString();
}

function modelInfoToCatalog(model: ModelInfo): CatalogModel {
  return {
    id: model.path,
    name: model.name,
    path: model.path,
    publisher: model.publisher,
    category: model.category,
    architecture: model.architecture ?? "Unknown",
    parameters: model.parameters ?? "Unknown",
    quantization: model.quantization ?? "Unknown",
    size: formatModelSize(model.sizeBytes),
    modified: formatModified(model.modifiedMs),
    chatTemplate: model.chatTemplate,
    supportsReasoning: model.supportsReasoning,
  };
}

function createModelConfig(model: CatalogModel) {
  return {
    ...createDefaultModelConfig(),
    chatTemplate: model.chatTemplate ?? "",
  };
}

function runtimeCatalogModel(server: ServerStatus): CatalogModel {
  const fileName = server.modelPath.split(/[\\/]/).pop() || server.modelPath;
  const name = fileName.replace(/\.gguf$/i, "");

  return {
    id: `runtime-${server.port}`,
    name,
    path: server.modelPath,
    publisher: "Local",
    category: "LLM",
    architecture: "Unknown",
    parameters: "Unknown",
    quantization: "GGUF",
    size: "Loaded",
    modified: "Running",
    chatTemplate: null,
    supportsReasoning: false,
  };
}

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>("server");
  const [localModels, setLocalModels] = useState<CatalogModel[]>([]);
  const [catalogSelectedId, setCatalogSelectedId] = useState("");
  const [catalogConfigs, setCatalogConfigs] = useState<
    Record<string, ModelConfig>
  >({});
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [selectedServerPort, setSelectedServerPort] = useState<number | null>(
    null,
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [serverSettings, setServerSettings] = useState(
    createDefaultServerSettings,
  );
  const [huggingFaceModels, setHuggingFaceModels] = useState<
    HuggingFaceModelSummary[]
  >([]);
  const [selectedHuggingFaceRepoId, setSelectedHuggingFaceRepoId] = useState<
    string | null
  >(null);
  const [huggingFaceRepo, setHuggingFaceRepo] =
    useState<HuggingFaceRepoDetails | null>(null);
  const [huggingFaceSearching, setHuggingFaceSearching] = useState(false);
  const [huggingFaceRepoLoading, setHuggingFaceRepoLoading] = useState(false);
  const [downloadActivities, setDownloadActivities] = useState<
    DownloadActivity[]
  >([]);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const downloadSamplesRef = useRef<
    Record<
      string,
      {
        bytes: number;
        at: number;
        speed: number;
      }
    >
  >({});
  const [lastDownloadedModel, setLastDownloadedModel] =
    useState<DownloadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCatalogModel = useMemo(
    () =>
      localModels.find((model) => model.id === catalogSelectedId) ?? null,
    [catalogSelectedId, localModels],
  );

  const selectedCatalogConfig = selectedCatalogModel
    ? catalogConfigs[selectedCatalogModel.path] ?? null
    : null;

  const selectedServer = useMemo(
    () =>
      servers.find(
        (server) =>
          server.port === selectedServerPort && server.running,
      ) ?? null,
    [selectedServerPort, servers],
  );

  const runningServers = useMemo(
    () => servers.filter((server) => server.running),
    [servers],
  );

  const selectedServerModel = useMemo(() => {
    if (!selectedServer) {
      return null;
    }

    return (
      localModels.find((model) => model.path === selectedServer.modelPath) ??
      runtimeCatalogModel(selectedServer)
    );
  }, [localModels, selectedServer]);

  const selectedServerModelConfig = selectedServerModel
    ? catalogConfigs[selectedServerModel.path] ?? createModelConfig(selectedServerModel)
    : null;

  useEffect(() => {
    void refreshLocalModels();
    void refreshServers();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshServers();
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void listen<DownloadProgress>("model-download-progress", (event) => {
      const progress = event.payload;
      const now = Date.now();
      const previous = downloadSamplesRef.current[progress.downloadId];
      const elapsedMs = previous ? now - previous.at : 0;

      if (
        previous &&
        progress.status !== "completed" &&
        elapsedMs < 400
      ) {
        return;
      }

      const elapsedSeconds = previous
        ? Math.max(elapsedMs / 1000, 0.001)
        : 0;
      const instantSpeed = previous
        ? Math.max(progress.downloadedBytes - previous.bytes, 0) /
          elapsedSeconds
        : 0;
      const speed =
        progress.status === "completed"
          ? 0
          : previous?.speed
            ? previous.speed * 0.6 + instantSpeed * 0.4
            : instantSpeed;

      downloadSamplesRef.current[progress.downloadId] = {
        bytes: progress.downloadedBytes,
        at: now,
        speed,
      };

      setDownloadActivities((current) => {
        const existing = current.find(
          (activity) => activity.downloadId === progress.downloadId,
        );
        const next: DownloadActivity = {
          ...progress,
          speedBytesPerSecond: speed,
          completedAt:
            progress.status === "completed"
              ? existing?.completedAt ?? now
              : null,
        };

        return existing
          ? current.map((activity) =>
              activity.downloadId === progress.downloadId ? next : activity,
            )
          : [next, ...current];
      });

      if (progress.status === "completed") {
        delete downloadSamplesRef.current[progress.downloadId];
      }
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => dispose?.();
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

  async function refreshLocalModels() {
    try {
      const discovered = (await listModels()).map(modelInfoToCatalog);

      setLocalModels(discovered);
      setCatalogConfigs((current) => {
        const next = { ...current };

        discovered.forEach((model) => {
          if (!next[model.path]) {
            next[model.path] = createModelConfig(model);
          }
        });

        return next;
      });
      setCatalogSelectedId((current) => {
        if (discovered.some((model) => model.id === current)) {
          return current;
        }

        return discovered[0]?.id ?? "";
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
        if (
          current !== null &&
          nextServers.some(
            (server) => server.port === current && server.running,
          )
        ) {
          return current;
        }

        return nextServers.find((server) => server.running)?.port ?? null;
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

  function handleCatalogConfigChange(config: ModelConfig) {
    if (!selectedCatalogModel) {
      return;
    }

    setCatalogConfigs((current) => ({
      ...current,
      [selectedCatalogModel.path]: config,
    }));
  }

  function handleServerModelConfigChange(config: ModelConfig) {
    if (!selectedServerModel) {
      return;
    }

    setCatalogConfigs((current) => ({
      ...current,
      [selectedServerModel.path]: config,
    }));
  }

  async function handleLoadModel(model: CatalogModel) {
    const modelConfig =
      catalogConfigs[model.path] ?? createModelConfig(model);
    const usedPorts = new Set(
      servers.filter((server) => server.running).map((server) => server.port),
    );
    let port = serverSettings.port;

    while (usedPorts.has(port) && port < 65535) {
      port += 1;
    }

    if (usedPorts.has(port)) {
      setError("No available worker port could be allocated.");
      return;
    }

    const { systemPrompt: _, ...launchConfig } = modelConfig;
    const config: ServerConfig = {
      modelPath: model.path,
      host: serverSettings.serveOnLocalNetwork ? "0.0.0.0" : "127.0.0.1",
      port,
      apiKey:
        serverSettings.apiKeyEnabled && serverSettings.apiKey.trim()
          ? serverSettings.apiKey.trim()
          : "",
      ...launchConfig,
      chatTemplate:
        !modelConfig.chatTemplate.trim() ||
        modelConfig.chatTemplate === model.chatTemplate
          ? ""
          : modelConfig.chatTemplate,
    };

    try {
      const status = await startServer(config);
      setSelectedServerPort(status.port);
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

  async function handleHuggingFaceSearch(query: string) {
    setHuggingFaceSearching(true);

    try {
      const models = await searchHuggingFaceModels(query);
      setHuggingFaceModels(models);
      setError(null);

      const current = models.find(
        (model) => model.repoId === selectedHuggingFaceRepoId,
      );
      if (!current) {
        setSelectedHuggingFaceRepoId(null);
        setHuggingFaceRepo(null);
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setHuggingFaceSearching(false);
    }
  }

  async function handleSelectHuggingFaceModel(
    model: HuggingFaceModelSummary,
  ) {
    setSelectedHuggingFaceRepoId(model.repoId);
    setHuggingFaceRepoLoading(true);

    try {
      setHuggingFaceRepo(await huggingFaceModelFiles(model.repoId));
      setError(null);
    } catch (cause) {
      setHuggingFaceRepo(null);
      setError(String(cause));
    } finally {
      setHuggingFaceRepoLoading(false);
    }
  }

  function handleCloseHuggingFaceDetails() {
    setSelectedHuggingFaceRepoId(null);
    setHuggingFaceRepo(null);
    setHuggingFaceRepoLoading(false);
  }

  async function handleDownloadHuggingFaceFile(file: HuggingFaceFile) {
    if (!huggingFaceRepo) {
      return;
    }

    const downloadId = `${huggingFaceRepo.repoId}::${file.filename}`;
    const startedAt = Date.now();
    const initialProgress: DownloadProgress = {
      downloadId,
      repoId: huggingFaceRepo.repoId,
      filename: file.filename,
      downloadedBytes: 0,
      totalBytes: file.sizeBytes,
      status: "downloading",
    };

    setLastDownloadedModel(null);
    downloadSamplesRef.current[downloadId] = {
      bytes: 0,
      at: startedAt,
      speed: 0,
    };
    setDownloadActivities((current) => {
      const initialActivity: DownloadActivity = {
        ...initialProgress,
        speedBytesPerSecond: 0,
        completedAt: null,
      };
      const exists = current.some(
        (activity) => activity.downloadId === downloadId,
      );

      return exists
        ? current.map((activity) =>
            activity.downloadId === downloadId ? initialActivity : activity,
          )
        : [initialActivity, ...current];
    });

    try {
      const downloaded = await downloadHuggingFaceFile(
        huggingFaceRepo.repoId,
        file.filename,
        huggingFaceRepo.tags,
        huggingFaceRepo.pipelineTag,
      );
      setLastDownloadedModel(downloaded);
      setDownloadActivities((current) =>
        current.map((activity) =>
          activity.downloadId === downloadId
            ? {
                ...activity,
                downloadedBytes: downloaded.sizeBytes,
                totalBytes: downloaded.sizeBytes,
                status: "completed",
                speedBytesPerSecond: 0,
                completedAt: activity.completedAt ?? Date.now(),
              }
            : activity,
        ),
      );
      delete downloadSamplesRef.current[downloadId];
      await refreshLocalModels();
      setError(null);
    } catch (cause) {
      delete downloadSamplesRef.current[downloadId];
      setDownloadActivities((current) =>
        current.filter((activity) => activity.downloadId !== downloadId),
      );
      setError(String(cause));
    }
  }

  const statusLabel =
    runningServers.length === 0
      ? "Server stopped"
      : runningServers.length === 1
        ? `1 server running · localhost:${runningServers[0].port}`
        : `${runningServers.length} servers running`;
  const activeDownloadCount = downloadActivities.filter(
    (activity) => activity.status === "downloading",
  ).length;

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

        <div className="topbar-actions">
          <StatusBadge
            icon={runningServers.length > 0 ? Activity : Server}
            label={statusLabel}
            tone={runningServers.length > 0 ? "success" : "neutral"}
          />

          <div className="topbar-downloads">
            <IconButton
              className="topbar-download-button"
              icon={Download}
              label="Downloads"
              size={16}
              aria-expanded={downloadsOpen}
              onClick={() => setDownloadsOpen((current) => !current)}
            />
            {activeDownloadCount > 0 ? (
              <span className="topbar-download-badge">
                {activeDownloadCount}
              </span>
            ) : null}

            <DownloadActivityPopover
              open={downloadsOpen}
              activities={downloadActivities}
              onClose={() => setDownloadsOpen(false)}
              onClearCompleted={() =>
                setDownloadActivities((current) =>
                  current.filter(
                    (activity) => activity.status !== "completed",
                  ),
                )
              }
            />
          </div>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <ResizableWorkspace
        layoutMode={
          activePage === "downloads"
            ? selectedHuggingFaceRepoId
              ? "modelSearchDetail"
              : "modelSearchBrowse"
            : "standard"
        }
        left={
          <NavigationPanel
            activePage={activePage}
            onPageChange={setActivePage}
          />
        }
        main={
          <section
            className={
              activePage === "downloads"
                ? "main-panel main-panel--downloads"
                : "main-panel"
            }
          >
            {activePage === "server" ? (
              <ServerDashboard
                servers={servers}
                logs={logs}
                selectedPort={selectedServerPort}
                allModels={localModels}
                configs={catalogConfigs}
                serverSettings={serverSettings}
                onSelectServer={setSelectedServerPort}
                onStop={handleStop}
                onLoadModel={handleLoadModel}
                onServerSettingsChange={setServerSettings}
              />
            ) : activePage === "models" ? (
              <ModelLibrary
                models={localModels}
                selectedId={catalogSelectedId}
                onSelect={setCatalogSelectedId}
              />
            ) : (
              <DownloadsBrowser
                models={huggingFaceModels}
                selectedRepoId={selectedHuggingFaceRepoId}
                searching={huggingFaceSearching}
                onSearch={(query) => void handleHuggingFaceSearch(query)}
                onSelect={(model) => void handleSelectHuggingFaceModel(model)}
              />
            )}
          </section>
        }
        right={
          <aside
            className={
              activePage === "downloads"
                ? "inspector-panel inspector-panel--model-search"
                : "inspector-panel"
            }
          >
            {activePage === "server" ? (
              <ModelInspector
                selectedModel={selectedServerModel}
                config={selectedServerModelConfig}
                onChange={handleServerModelConfigChange}
              />
            ) : activePage === "models" ? (
              <ModelInspector
                selectedModel={selectedCatalogModel}
                config={selectedCatalogConfig}
                onChange={handleCatalogConfigChange}
              />
            ) : (
              <DownloadInspector
                repo={huggingFaceRepo}
                loading={huggingFaceRepoLoading}
                activities={downloadActivities}
                downloaded={lastDownloadedModel}
                onClose={handleCloseHuggingFaceDetails}
                onDownload={(file) => void handleDownloadHuggingFaceFile(file)}
              />
            )}
          </aside>
        }
      />
    </main>
  );
}
