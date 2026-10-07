import { invoke } from "@tauri-apps/api/core";

export type ModelInfo = {
  name: string;
  path: string;
  sizeBytes: number;
};

export type ServerConfig = {
  modelPath: string;
  host: string;
  port: number;
  contextSize: number | null;
  gpuLayers: number | null;
  temperature: number | null;
  flashAttention: boolean;
  extraArgs: string[];
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
