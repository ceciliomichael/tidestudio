import { invoke } from "@tauri-apps/api/core";
import type {
  DownloadedModel,
  HuggingFaceModelSummary,
  HuggingFaceRepoDetails,
} from "../features/downloads/types";
import type {
  LiveInferenceDefaults,
  ModelConfig,
  ModelSettingsFile,
} from "./config";

export type ModelInfo = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedMs: number | null;
  publisher: string;
  category: "LLM" | "Embedding" | "Drafter" | "DECISION";
  architecture: string | null;
  parameters: string | null;
  contextLength: number | null;
  poolingType: string | null;
  quantization: string | null;
  chatTemplate: string | null;
  tokenizerFingerprint: string | null;
  supportsMtp: boolean;
  supportsReasoning: boolean;
  supportsThinkingToggle: boolean;
  supportsReasoningEffort: boolean;
  supportsReasoningPreserve: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
};

export type ServerConfig = ModelConfig & {
  modelPath: string;
  modelName: string;
  modelCategory: ModelInfo["category"];
  quantization: string;
  supportsReasoning: boolean;
  supportsThinkingToggle: boolean;
  supportsReasoningEffort: boolean;
  supportsReasoningPreserve: boolean;
  supportsMtp: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
};

export type ServerStatus = {
  backend: string;
  modelPath: string;
  modelId: string;
  modelName: string;
  modelCategory: ModelInfo["category"];
  quantization: string;
  supportsMtp: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  port: number;
  pid: number;
  memoryBytes: number;
  running: boolean;
  state: "loading" | "ready";
};

export type ServerStartFailure = {
  port: number;
  modelId: string;
  modelPath: string;
  error: string;
};

export type GatewayConfig = {
  port: number;
  serveOnLocalNetwork: boolean;
  apiKeyEnabled: boolean;
  apiKey: string;
  corsEnabled: boolean;
  jitModelLoading: boolean;
  autoUnloadJitModels: boolean;
  maxIdleTtlMinutes: number;
  onlyKeepLastJitModel: boolean;
};

export type ModelsDirectoryInfo = {
  path: string;
  defaultPath: string;
  isDefault: boolean;
};

export const configureGateway = (config: GatewayConfig) =>
  invoke<void>("configure_gateway", { config });

export const configureGatewayBackground = (config: GatewayConfig) =>
  invoke<void>("configure_gateway_background", { config });

export const gatewayStatus = () => invoke<boolean>("gateway_status");

export const listModels = () => invoke<ModelInfo[]>("list_models");

export const getModelsDirectory = () =>
  invoke<ModelsDirectoryInfo>("get_models_directory");

export const setModelsDirectory = (path: string) =>
  invoke<ModelsDirectoryInfo>("set_models_directory", { path });

export const resetModelsDirectory = () =>
  invoke<ModelsDirectoryInfo>("reset_models_directory");

export const loadModelSettings = (modelPath: string) =>
  invoke<ModelSettingsFile | null>("load_model_settings", { modelPath });

export const saveModelSettings = (
  modelPath: string,
  settings: ModelSettingsFile,
) => invoke<void>("save_model_settings", { modelPath, settings });

export const deleteModel = (modelPath: string) =>
  invoke<void>("delete_model", { modelPath });

export const startServer = (config: ServerConfig) =>
  invoke<ServerStatus>("start_server", { config });

export const stopServer = (port: number) =>
  invoke<ServerStatus>("stop_server", { port });

export const updateServerInference = (
  port: number,
  defaults: LiveInferenceDefaults,
) => invoke<void>("update_server_inference", { port, defaults });

export const listServers = () => invoke<ServerStatus[]>("list_servers");

export const serverStatus = (port: number) =>
  invoke<ServerStatus | null>("server_status", { port });

export const serverLogs = (port: number) =>
  invoke<string[]>("server_logs", { port });

export const getUiPreference = (key: string) =>
  invoke<string | null>("get_ui_preference", { key });

export const setUiPreference = (key: string, value: string) =>
  invoke<void>("set_ui_preference", { key, value });

export const searchHuggingFaceModels = (query: string) =>
  invoke<HuggingFaceModelSummary[]>("search_huggingface_models", { query });

export const huggingFaceModelFiles = (repoId: string) =>
  invoke<HuggingFaceRepoDetails>("huggingface_model_files", { repoId });

export const searchModelScopeModels = (query: string) =>
  invoke<HuggingFaceModelSummary[]>("search_modelscope_models", { query });

export const modelScopeModelFiles = (repoId: string) =>
  invoke<HuggingFaceRepoDetails>("modelscope_model_files", { repoId });

export const downloadHuggingFaceFile = (
  repoId: string,
  filename: string,
  tags: string[],
  pipelineTag: string | null,
) =>
  invoke<DownloadedModel>("download_huggingface_file", {
    repoId,
    filename,
    tags,
    pipelineTag,
  });

export const downloadModelScopeFile = (
  repoId: string,
  filename: string,
  tags: string[],
  pipelineTag: string | null,
) =>
  invoke<DownloadedModel>("download_modelscope_file", {
    repoId,
    filename,
    tags,
    pipelineTag,
  });
