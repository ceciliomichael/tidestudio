export type SpeculativeMode = "none" | "mtp" | "draft";
export type EmbeddingPooling = "model" | "mean" | "cls" | "last";

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
  cpuThreads: number | null;
  batchSize: number | null;
  microBatchSize: number | null;
  parallelSlots: number | null;
  kvCacheOffload: boolean;
  ropeFrequencyBase: number | null;
  ropeFrequencyScale: number | null;
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
  embeddingPooling: EmbeddingPooling;
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
    | "cpuThreads"
    | "batchSize"
    | "microBatchSize"
    | "parallelSlots"
    | "kvCacheOffload"
    | "ropeFrequencyBase"
    | "ropeFrequencyScale"
    | "chatTemplate"
    | "flashAttention"
    | "embeddingPooling"
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

export type LiveInferenceDefaults = Omit<
  ModelSettingsFile["inference"],
  "thinkingEnabled" | "reasoningPreserve"
> & {
  thinkingEnabled: boolean | null;
  reasoningPreserve: boolean | null;
};

export type ReasoningCapabilities = {
  supportsReasoning: boolean;
  supportsThinkingToggle: boolean;
  supportsReasoningEffort: boolean;
  supportsReasoningPreserve: boolean;
};

export function createDefaultModelConfig(): ModelConfig {
  return {
    contextSize: 4096,
    gpuLayers: 99,
    cpuThreads: null,
    batchSize: null,
    microBatchSize: null,
    parallelSlots: null,
    kvCacheOffload: true,
    ropeFrequencyBase: null,
    ropeFrequencyScale: null,
    systemPrompt: "",
    chatTemplate: "",
    thinkingEnabled: false,
    reasoningEffort: "default",
    reasoningBudget: 1024,
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
    embeddingPooling: "model",
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
      cpuThreads: config.cpuThreads,
      batchSize: config.batchSize,
      microBatchSize: config.microBatchSize,
      parallelSlots: config.parallelSlots,
      kvCacheOffload: config.kvCacheOffload,
      ropeFrequencyBase: config.ropeFrequencyBase,
      ropeFrequencyScale: config.ropeFrequencyScale,
      chatTemplate: config.chatTemplate,
      flashAttention: config.flashAttention,
      embeddingPooling: config.embeddingPooling,
      speculativeMode: config.speculativeMode,
      draftModelPath: config.draftModelPath,
      draftGpuLayers: config.draftGpuLayers,
      draftMaxTokens: config.draftMaxTokens,
      draftMinTokens: config.draftMinTokens,
      draftMinProbability: config.draftMinProbability,
      extraArgs: config.extraArgs,
    },
    inference: {
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
    },
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
  capabilities: ReasoningCapabilities,
): LiveInferenceDefaults {
  return {
    systemPrompt: config.systemPrompt,
    thinkingEnabled: capabilities.supportsThinkingToggle
      ? config.thinkingEnabled
      : null,
    reasoningEffort: capabilities.supportsReasoningEffort
      ? config.reasoningEffort
      : "default",
    reasoningBudget: capabilities.supportsReasoning
      ? config.reasoningBudget
      : null,
    reasoningPreserve: capabilities.supportsReasoningPreserve
      ? config.reasoningPreserve
      : null,
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
    port: 3456,
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
