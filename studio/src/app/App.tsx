import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
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
  ModelSearchSource,
} from "../features/downloads/types";
import { ModelLibrary } from "../features/models/ModelLibrary";
import { ModelInspector } from "../features/models/ModelInspector";
import type { CatalogModel } from "../features/models/types";
import { ServerDashboard } from "../features/server/ServerDashboard";
import {
  createDefaultModelConfig,
  createDefaultServerSettings,
  liveInferenceDefaultsFromConfig,
  modelConfigFromSettingsFile,
  modelConfigToSettingsFile,
  type ModelConfig,
} from "../lib/config";
import {
  configureGateway,
  configureGatewayBackground,
  deleteModel,
  downloadHuggingFaceFile,
  downloadModelScopeFile,
  gatewayStatus,
  getUiPreference,
  huggingFaceModelFiles,
  loadModelSettings,
  listModels,
  listServers,
  modelScopeModelFiles,
  searchHuggingFaceModels,
  searchModelScopeModels,
  serverLogs,
  saveModelSettings,
  setUiPreference,
  startServer,
  stopServer,
  updateServerInference,
  type ModelInfo,
  type ServerConfig,
  type ServerStartFailure,
  type ServerStatus,
} from "../lib/tauri";

function modelSearchCacheKey(source: ModelSearchSource) {
  return `model_search.default_results.v3.${source}`;
}

const LEGACY_HUGGING_FACE_CACHE_KEY = "model_search.default_results.v2";
const SERVER_SETTINGS_PREFERENCE_KEY = "server.settings.v1";
import {
  NavigationPanel,
  type ActivePage,
} from "./NavigationPanel";
import { ResizableWorkspace } from "./ResizableWorkspace";
import { SettingsSidebar, type SettingsSectionId } from "../features/settings/SettingsSidebar";
import { GeneralSettings } from "../features/settings/GeneralSettings";
import { UpdatesSettings } from "../features/settings/UpdatesSettings";
import { useAppearancePreferences } from "../lib/appearance";

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

  return new Date(modifiedMs).toLocaleDateString(document.documentElement.lang || "en-US");
}

function formatContextLength(contextLength: number | null) {
  if (!contextLength || contextLength <= 0) {
    return "Unknown";
  }

  if (contextLength >= 1024) {
    const value = contextLength / 1024;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}k`;
  }

  return contextLength.toLocaleString();
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
    contextLength: formatContextLength(model.contextLength),
    poolingType: model.poolingType,
    quantization: model.quantization ?? "Unknown",
    size: formatModelSize(model.sizeBytes),
    modified: formatModified(model.modifiedMs),
    chatTemplate: model.chatTemplate,
    supportsMtp: model.supportsMtp,
    supportsReasoning: model.supportsReasoning,
    supportsThinkingToggle: model.supportsThinkingToggle,
    supportsReasoningEffort: model.supportsReasoningEffort,
    supportsReasoningPreserve: model.supportsReasoningPreserve,
    supportsVision: model.supportsVision,
  };
}

function createModelConfig(model: CatalogModel): ModelConfig {
  const detectedPooling =
    model.poolingType === "mean" ||
    model.poolingType === "cls" ||
    model.poolingType === "last"
      ? model.poolingType
      : "model";

  return {
    ...createDefaultModelConfig(),
    chatTemplate: model.chatTemplate ?? "",
    embeddingPooling: detectedPooling,
    speculativeMode:
      model.category === "LLM" && model.supportsMtp ? "mtp" : "none",
  };
}

function runtimeCatalogModel(server: ServerStatus): CatalogModel {
  const fileName = server.modelPath.split(/[\\/]/).pop() || server.modelPath;
  const name = server.modelName || fileName.replace(/\.gguf$/i, "");

  return {
    id: `runtime-${server.port}`,
    name,
    path: server.modelPath,
    publisher: "Local",
    category: server.modelCategory,
    architecture: "Unknown",
    parameters: "Unknown",
    contextLength: "Unknown",
    poolingType: null,
    quantization: server.quantization || "Unknown",
    size: "Loaded",
    modified: "Running",
    chatTemplate: null,
    supportsMtp: server.supportsMtp,
    supportsReasoning: false,
    supportsThinkingToggle: false,
    supportsReasoningEffort: false,
    supportsReasoningPreserve: false,
    supportsVision: server.supportsVision,
  };
}

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>("server");
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("general");
  const { appearance, language, changeAppearance, changeLanguage } = useAppearancePreferences();
  const [localModels, setLocalModels] = useState<CatalogModel[]>([]);
  const [catalogSelectedId, setCatalogSelectedId] = useState("");
  const [catalogConfigs, setCatalogConfigs] = useState<
    Record<string, ModelConfig>
  >({});
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [pendingModelPaths, setPendingModelPaths] = useState<string[]>([]);
  const [selectedServerPort, setSelectedServerPort] = useState<number | null>(
    null,
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [serverSettings, setServerSettings] = useState(
    createDefaultServerSettings,
  );
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [huggingFaceModels, setHuggingFaceModels] = useState<
    HuggingFaceModelSummary[]
  >([]);
  const [modelSearchSource, setModelSearchSource] =
    useState<ModelSearchSource>("huggingface");
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
  const modelSettingsSaveRef = useRef<Record<string, Promise<void>>>({});
  const modelSearchPrimedRef = useRef(false);
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
    void restoreServerSettings();
  }, []);

  useEffect(() => {
    if (activePage !== "downloads" || modelSearchPrimedRef.current) {
      return;
    }

    modelSearchPrimedRef.current = true;
    void primeModelSearch();
  }, [activePage]);

  async function searchModels(
    source: ModelSearchSource,
    query: string,
  ) {
    return source === "modelscope"
      ? searchModelScopeModels(query)
      : searchHuggingFaceModels(query);
  }

  async function primeModelSearch() {
    let restored = false;
    const cacheKey = modelSearchCacheKey("huggingface");

    try {
      const cached =
        (await getUiPreference(cacheKey)) ??
        (await getUiPreference(LEGACY_HUGGING_FACE_CACHE_KEY));
      if (cached) {
        const parsed = JSON.parse(cached) as HuggingFaceModelSummary[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((model) => ({
            ...model,
            source: "huggingface" as const,
          }));
          setHuggingFaceModels(normalized);
          void setUiPreference(cacheKey, JSON.stringify(normalized));
          restored = true;
        }
      }
    } catch {
      // Ignore stale or unreadable cache data and refresh from Hugging Face.
    }

    try {
      const models = await searchHuggingFaceModels("");
      if (models.length > 0) {
        setHuggingFaceModels(models);
        void setUiPreference(cacheKey, JSON.stringify(models));
      }
    } catch (cause) {
      if (!restored) {
        setError(String(cause));
      }
    }
  }

  async function restoreServerSettings() {
    let settings = createDefaultServerSettings();
    try {
      const saved = await getUiPreference(SERVER_SETTINGS_PREFERENCE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<typeof settings>;
        settings = {
          ...settings,
          ...parsed,
        };
      }
    } catch {
      // Keep defaults when persisted server settings are unavailable.
    }
    setServerSettings(settings);
    void configureGatewayBackground(settings).catch((cause) =>
      setError(String(cause)),
    );
  }

  async function applyGatewaySettings(
    settings: ReturnType<typeof createDefaultServerSettings>,
    persist = true,
  ) {
    try {
      await configureGateway(settings);
      setGatewayRunning(await gatewayStatus());
      setServerSettings(settings);
    } catch (cause) {
      setGatewayRunning(false);
      setError(String(cause));
      return;
    }

    if (persist) {
      try {
        await setUiPreference(
          SERVER_SETTINGS_PREFERENCE_KEY,
          JSON.stringify(settings),
        );
      } catch (cause) {
        setError(String(cause));
        return;
      }
    }

    setError(null);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshServers();
      void gatewayStatus().then(setGatewayRunning).catch(() => setGatewayRunning(false));
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
    let disposeStatus: (() => void) | undefined;
    let disposeFailure: (() => void) | undefined;
    let disposeGatewayStatus: (() => void) | undefined;
    let disposeGatewayFailure: (() => void) | undefined;

    void listen<ServerStatus>("server-status-changed", (event) => {
      const status = event.payload;
      setServers((current) => {
        const exists = current.some((server) => server.port === status.port);
        return exists
          ? current.map((server) =>
              server.port === status.port ? status : server,
            )
          : [...current, status];
      });
    }).then((unlisten) => {
      disposeStatus = unlisten;
    });

    void listen<ServerStartFailure>("server-start-failed", (event) => {
      const failure = event.payload;
      setPendingModelPaths((current) =>
        current.filter((path) => path !== failure.modelPath),
      );
      setServers((current) =>
        current.filter((server) => server.port !== failure.port),
      );
      setSelectedServerPort((current) =>
        current === failure.port ? null : current,
      );
      setError(failure.error);
    }).then((unlisten) => {
      disposeFailure = unlisten;
    });

    void listen<boolean>("gateway-status-changed", (event) => {
      setGatewayRunning(event.payload);
    }).then((unlisten) => {
      disposeGatewayStatus = unlisten;
    });

    void listen<string>("gateway-start-failed", (event) => {
      setGatewayRunning(false);
      setError(event.payload);
    }).then((unlisten) => {
      disposeGatewayFailure = unlisten;
    });

    return () => {
      disposeStatus?.();
      disposeFailure?.();
      disposeGatewayStatus?.();
      disposeGatewayFailure?.();
    };
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
      const persistedConfigs = await Promise.all(
        discovered.map(async (model) => {
          const fallback = createModelConfig(model);
          try {
            const settings = await loadModelSettings(model.path);
            return [
              model.path,
              settings
                ? modelConfigFromSettingsFile(settings, fallback)
                : fallback,
            ] as const;
          } catch {
            return [model.path, fallback] as const;
          }
        }),
      );

      setLocalModels(discovered);
      setCatalogConfigs((current) => {
        const next = { ...current };

        persistedConfigs.forEach(([path, config]) => {
          if (!next[path]) {
            next[path] = config;
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

  function persistModelConfig(modelPath: string, config: ModelConfig) {
    const previous =
      modelSettingsSaveRef.current[modelPath] ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() =>
        saveModelSettings(modelPath, modelConfigToSettingsFile(config)),
      );
    modelSettingsSaveRef.current[modelPath] = next;

    const cleanup = () => {
      if (modelSettingsSaveRef.current[modelPath] === next) {
        delete modelSettingsSaveRef.current[modelPath];
      }
    };
    void next.then(cleanup, cleanup);
    return next;
  }

  function handleCatalogConfigChange(config: ModelConfig) {
    if (!selectedCatalogModel) {
      return;
    }

    setCatalogConfigs((current) => ({
      ...current,
      [selectedCatalogModel.path]: config,
    }));
    void persistModelConfig(selectedCatalogModel.path, config).catch((cause) =>
      setError(String(cause)),
    );
    const defaults = liveInferenceDefaultsFromConfig(
      config,
      selectedCatalogModel,
    );
    for (const server of runningServers) {
      if (server.modelPath !== selectedCatalogModel.path) {
        continue;
      }
      void updateServerInference(server.port, defaults).catch((cause) =>
        setError(String(cause)),
      );
    }
  }

  async function handleDeleteCatalogModel(model: CatalogModel) {
    const pendingSave = modelSettingsSaveRef.current[model.path];
    if (pendingSave) {
      await pendingSave.catch(() => undefined);
    }

    try {
      const matchingServers = servers.filter(
        (server) => server.running && server.modelPath === model.path,
      );
      for (const server of matchingServers) {
        await stopServer(server.port);
      }

      await deleteModel(model.path);
      setCatalogConfigs((current) => {
        const next = { ...current };
        delete next[model.path];
        return next;
      });
      if (matchingServers.length > 0) {
        await refreshServers();
      }
      await refreshLocalModels();
      setError(null);
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }

  function handleServerModelConfigChange(config: ModelConfig) {
    if (!selectedServerModel) {
      return;
    }

    setCatalogConfigs((current) => ({
      ...current,
      [selectedServerModel.path]: config,
    }));
    void persistModelConfig(selectedServerModel.path, config).catch((cause) =>
      setError(String(cause)),
    );
    if (selectedServer) {
      void updateServerInference(
        selectedServer.port,
        liveInferenceDefaultsFromConfig(
          config,
          selectedServerModel,
        ),
      ).catch((cause) => setError(String(cause)));
    }
  }

  async function handleLoadModel(model: CatalogModel) {
    if (model.category === "Embedding" && model.poolingType === "rank") {
      setError(
        "This GGUF is a reranking model (rank pooling). TideStudio does not expose a public reranking endpoint yet.",
      );
      return;
    }

    const modelConfig =
      catalogConfigs[model.path] ?? createModelConfig(model);
    const config: ServerConfig = {
      modelPath: model.path,
      modelName: model.name,
      modelCategory: model.category,
      quantization: model.quantization,
      supportsReasoning: model.supportsReasoning,
      supportsThinkingToggle: model.supportsThinkingToggle,
      supportsReasoningEffort: model.supportsReasoningEffort,
      supportsReasoningPreserve: model.supportsReasoningPreserve,
      supportsMtp: model.supportsMtp,
      supportsVision: model.supportsVision,
      ...modelConfig,
      speculativeMode:
        model.category !== "LLM"
          ? "none"
          : modelConfig.speculativeMode === "mtp" && !model.supportsMtp
            ? "none"
            : modelConfig.speculativeMode,
      chatTemplate:
        model.category !== "LLM" ||
        !modelConfig.chatTemplate.trim() ||
        modelConfig.chatTemplate === model.chatTemplate
          ? ""
          : modelConfig.chatTemplate,
    };

    setPendingModelPaths((current) =>
      current.includes(model.path) ? current : [...current, model.path],
    );
    setError(null);

    try {
      await persistModelConfig(model.path, modelConfig);
      const status = await startServer(config);
      setPendingModelPaths((current) =>
        current.filter((path) => path !== model.path),
      );
      setServers((current) => {
        const exists = current.some((server) => server.port === status.port);
        return exists
          ? current.map((server) =>
              server.port === status.port ? status : server,
            )
          : [...current, status];
      });
      setSelectedServerPort(status.port);
      setError(null);
      void refreshServers();
      void refreshLogs(status.port);
    } catch (cause) {
      setPendingModelPaths((current) =>
        current.filter((path) => path !== model.path),
      );
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

  async function handleModelSearch(
    query: string,
    source: ModelSearchSource = modelSearchSource,
  ) {
    setHuggingFaceSearching(true);

    try {
      const models = await searchModels(source, query);
      setHuggingFaceModels(models);
      if (!query.trim() && models.length > 0) {
        void setUiPreference(
          modelSearchCacheKey(source),
          JSON.stringify(models),
        );
      }
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

  async function handleModelSearchSourceChange(
    source: ModelSearchSource,
    query: string,
  ) {
    if (source === modelSearchSource) {
      return;
    }

    setModelSearchSource(source);
    setSelectedHuggingFaceRepoId(null);
    setHuggingFaceRepo(null);
    setLastDownloadedModel(null);
    setHuggingFaceModels([]);

    if (!query.trim()) {
      try {
        const cached = await getUiPreference(modelSearchCacheKey(source));
        if (cached) {
          const parsed = JSON.parse(cached) as HuggingFaceModelSummary[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHuggingFaceModels(parsed);
          }
        }
      } catch {
        // Continue with a network refresh when there is no usable cache.
      }
    }

    await handleModelSearch(query, source);
  }

  async function handleSelectHuggingFaceModel(
    model: HuggingFaceModelSummary,
  ) {
    setSelectedHuggingFaceRepoId(model.repoId);
    setHuggingFaceRepoLoading(true);

    try {
      setHuggingFaceRepo(
        model.source === "modelscope"
          ? await modelScopeModelFiles(model.repoId)
          : await huggingFaceModelFiles(model.repoId),
      );
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

    const downloadId =
      `${huggingFaceRepo.source}::${huggingFaceRepo.repoId}::${file.filename}`;
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
      const download =
        huggingFaceRepo.source === "modelscope"
          ? downloadModelScopeFile
          : downloadHuggingFaceFile;
      const downloaded = await download(
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

  const activeDownloadCount = downloadActivities.filter(
    (activity) => activity.status === "downloading",
  ).length;

  return (
    <main className="app-shell">
      {error ? <div className="error-banner">{error}</div> : null}

      <ResizableWorkspace
        layoutMode={
          activePage === "settings"
            ? "settings"
            : activePage === "downloads"
            ? selectedHuggingFaceRepoId
              ? "modelSearchDetail"
              : "modelSearchBrowse"
            : "standard"
        }
        left={
          activePage === "settings" ? (
            <SettingsSidebar
              selected={settingsSection}
              onSelect={setSettingsSection}
              onBack={() => setActivePage("server")}
            />
          ) : (
            <NavigationPanel
              activePage={activePage}
              onPageChange={setActivePage}
              footer={
                <div className="topbar-downloads">
                  <button
                    className="navigation-download-button"
                    type="button"
                    aria-expanded={downloadsOpen}
                    onClick={() => setDownloadsOpen((current) => !current)}
                  >
                    <Download size={16} strokeWidth={1.9} aria-hidden="true" />
                    <span>Downloads</span>
                    {activeDownloadCount > 0 ? (
                      <span className="navigation-download-badge">
                        {activeDownloadCount}
                      </span>
                    ) : null}
                  </button>

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
              }
            />
          )
        }
        main={
          <section
            className={
              activePage === "settings"
                ? "main-panel main-panel--settings"
                : activePage === "downloads"
                ? "main-panel main-panel--downloads"
                : "main-panel"
            }
          >
            {activePage === "settings" ? (
              <div className="settings-workspace__main">
                {settingsSection === "general" ? (
                  <GeneralSettings
                    appearance={appearance}
                    language={language}
                    onAppearanceChange={changeAppearance}
                    onLanguageChange={changeLanguage}
                  />
                ) : (
                  <UpdatesSettings />
                )}
              </div>
            ) : activePage === "server" ? (
              <ServerDashboard
                servers={servers}
                pendingModelPaths={pendingModelPaths}
                logs={logs}
                selectedPort={selectedServerPort}
                allModels={localModels}
                configs={catalogConfigs}
                serverSettings={serverSettings}
                gatewayRunning={gatewayRunning}
                onSelectServer={setSelectedServerPort}
                onStop={handleStop}
                onLoadModel={handleLoadModel}
                onServerSettingsChange={applyGatewaySettings}
              />
            ) : activePage === "models" ? (
              <ModelLibrary
                models={localModels}
                selectedId={catalogSelectedId}
                onSelect={setCatalogSelectedId}
                onDelete={handleDeleteCatalogModel}
              />
            ) : (
              <DownloadsBrowser
                models={huggingFaceModels}
                source={modelSearchSource}
                selectedRepoId={selectedHuggingFaceRepoId}
                searching={huggingFaceSearching}
                onSearch={(query) => void handleModelSearch(query)}
                onSourceChange={(source, query) =>
                  void handleModelSearchSourceChange(source, query)
                }
                onSelect={(model) => void handleSelectHuggingFaceModel(model)}
              />
            )}
          </section>
        }
        right={activePage === "settings" ? null : (
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
                runtimeLoaded
                onChange={handleServerModelConfigChange}
              />
            ) : activePage === "models" ? (
              <ModelInspector
                selectedModel={selectedCatalogModel}
                config={selectedCatalogConfig}
                runtimeLoaded={
                  selectedCatalogModel !== null &&
                  runningServers.some(
                    (server) => server.modelPath === selectedCatalogModel.path,
                  )
                }
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
        )}
      />
    </main>
  );
}
