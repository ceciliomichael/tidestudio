import { invoke } from "@tauri-apps/api/core";
import type {
  DownloadedModel,
  HuggingFaceModelSummary,
  HuggingFaceRepoDetails,
} from "../features/downloads/types";
import type { ModelConfig } from "./config";

export type ModelInfo = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedMs: number | null;
  publisher: string;
  category: "LLM" | "Embedding" | "Drafter";
  architecture: string | null;
  parameters: string | null;
  quantization: string | null;
  chatTemplate: string | null;
  supportsReasoning: boolean;
};

export type ServerConfig = Omit<ModelConfig, "systemPrompt"> & {
  modelPath: string;
  host: string;
  port: number;
  apiKey: string;
};

export type ServerStatus = {
  backend: string;
  modelPath: string;
  port: number;
  pid: number;
  running: boolean;
};

export const listModels = () => invoke<ModelInfo[]>("list_models");

export const startServer = (config: ServerConfig) =>
  invoke<ServerStatus>("start_server", { config });

export const stopServer = (port: number) =>
  invoke<ServerStatus>("stop_server", { port });

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
