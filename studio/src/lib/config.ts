export type SpeculativeMode = "none" | "mtp" | "draft";

export type ServerSettings = {
  port: number;
  serveOnLocalNetwork: boolean;
  apiKeyEnabled: boolean;
  apiKey: string;
  allowPerRequestMcps: boolean;
  allowMcpJsonServers: boolean;
  corsEnabled: boolean;
  jitModelLoading: boolean;
  autoUnloadJitModels: boolean;
  maxIdleTtlMinutes: number;
  onlyKeepLastJitModel: boolean;
};

export type ReasoningEffort =
  | "default"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type ModelConfig = {
  contextSize: number | null;
  gpuLayers: number | null;
  systemPrompt: string;
  chatTemplate: string;
  thinkingEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  reasoningBudget: number | null;
  reasoningPreserve: boolean;
  temperature: number | null;
  topK: number | null;
  topP: number | null;
  minP: number | null;
  typicalP: number | null;
  seed: number | null;
  repeatPenalty: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  flashAttention: boolean;
  speculativeMode: SpeculativeMode;
  draftModelPath: string;
  draftGpuLayers: number | null;
  draftMaxTokens: number | null;
  draftMinTokens: number | null;
  draftMinProbability: number | null;
  extraArgs: string[];
};

export function createDefaultModelConfig(): ModelConfig {
  return {
    contextSize: 32768,
    gpuLayers: 99,
    systemPrompt: "",
    chatTemplate: "",
    thinkingEnabled: false,
    reasoningEffort: "default",
    reasoningBudget: -1,
    reasoningPreserve: true,
    temperature: 0.8,
    topK: 40,
    topP: 0.95,
    minP: 0.05,
    typicalP: 1,
    seed: -1,
    repeatPenalty: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    flashAttention: true,
    speculativeMode: "none",
    draftModelPath: "",
    draftGpuLayers: 99,
    draftMaxTokens: 3,
    draftMinTokens: 0,
    draftMinProbability: 0,
    extraArgs: [],
  };
}

export function createDefaultServerSettings(): ServerSettings {
  return {
    port: 8080,
    serveOnLocalNetwork: false,
    apiKeyEnabled: false,
    apiKey: "",
    allowPerRequestMcps: true,
    allowMcpJsonServers: false,
    corsEnabled: true,
    jitModelLoading: true,
    autoUnloadJitModels: true,
    maxIdleTtlMinutes: 60,
    onlyKeepLastJitModel: true,
  };
}
