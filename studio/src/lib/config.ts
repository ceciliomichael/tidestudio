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

export type ModelSettingsFile = {
  version: 1;
  load: Pick<
    ModelConfig,
    | "contextSize"
    | "gpuLayers"
    | "chatTemplate"
    | "flashAttention"
    | "speculativeMode"
    | "draftModelPath"
    | "draftGpuLayers"
    | "draftMaxTokens"
    | "draftMinTokens"
    | "draftMinProbability"
    | "extraArgs"
  >;
  inference: Pick<
    ModelConfig,
    | "systemPrompt"
    | "thinkingEnabled"
    | "reasoningEffort"
    | "reasoningBudget"
    | "reasoningPreserve"
    | "temperature"
    | "topK"
    | "topP"
    | "minP"
    | "typicalP"
    | "seed"
    | "repeatPenalty"
    | "presencePenalty"
    | "frequencyPenalty"
  >;
};

export type LiveInferenceDefaults = ModelSettingsFile["inference"];

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

export function modelConfigToSettingsFile(
  config: ModelConfig,
): ModelSettingsFile {
  return {
    version: 1,
    load: {
      contextSize: config.contextSize,
      gpuLayers: config.gpuLayers,
      chatTemplate: config.chatTemplate,
      flashAttention: config.flashAttention,
      speculativeMode: config.speculativeMode,
      draftModelPath: config.draftModelPath,
      draftGpuLayers: config.draftGpuLayers,
      draftMaxTokens: config.draftMaxTokens,
      draftMinTokens: config.draftMinTokens,
      draftMinProbability: config.draftMinProbability,
      extraArgs: config.extraArgs,
    },
    inference: liveInferenceDefaultsFromConfig(config),
  };
}

export function modelConfigFromSettingsFile(
  settings: ModelSettingsFile,
  fallback: ModelConfig,
): ModelConfig {
  if (
    settings.version !== 1 ||
    !settings.load ||
    !settings.inference
  ) {
    return fallback;
  }

  return {
    ...fallback,
    ...settings.load,
    ...settings.inference,
  };
}

export function liveInferenceDefaultsFromConfig(
  config: ModelConfig,
): LiveInferenceDefaults {
  return {
    systemPrompt: config.systemPrompt,
    thinkingEnabled: config.thinkingEnabled,
    reasoningEffort: config.reasoningEffort,
    reasoningBudget: config.reasoningBudget,
    reasoningPreserve: config.reasoningPreserve,
    temperature: config.temperature,
    topK: config.topK,
    topP: config.topP,
    minP: config.minP,
    typicalP: config.typicalP,
    seed: config.seed,
    repeatPenalty: config.repeatPenalty,
    presencePenalty: config.presencePenalty,
    frequencyPenalty: config.frequencyPenalty,
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
