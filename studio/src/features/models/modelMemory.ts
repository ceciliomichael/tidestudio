import type { ModelConfig } from "../../lib/config";
import type { CatalogModel } from "./types";

const GIB = 1024 ** 3;

type CacheType = { block: number; bytes: number };
const CACHE_TYPES: Record<string, CacheType> = {
  f32: { block: 1, bytes: 4 },
  f16: { block: 1, bytes: 2 },
  bf16: { block: 1, bytes: 2 },
  q8_0: { block: 32, bytes: 34 },
  q4_0: { block: 32, bytes: 18 },
  q4_1: { block: 32, bytes: 20 },
  q5_0: { block: 32, bytes: 22 },
  q5_1: { block: 32, bytes: 24 },
  q2_k: { block: 256, bytes: 84 },
  q3_k: { block: 256, bytes: 110 },
  q4_k: { block: 256, bytes: 144 },
  q5_k: { block: 256, bytes: 176 },
  q6_k: { block: 256, bytes: 210 },
  q8_k: { block: 256, bytes: 292 },
};

// Known homogeneous full-attention GGUF architectures. Hybrid, sliding-window,
// recurrent, encoder and MLA layouts are deliberately not inferred from one
// scalar set of attention dimensions.
const HOMOGENEOUS_ATTENTION = new Set([
  "llama", "mistral", "qwen2", "qwen3", "phi2", "phi3", "gemma",
]);

function perLayerCacheArchitecture(architecture: string): boolean {
  return architecture === "qwen35" || architecture === "lfm2" || architecture === "lfm2moe";
}

export type ModelMemoryEstimate = {
  cpuWeightsBytes: number | null;
  gpuWeightsBytes: number | null;
  cpuKvBytes: number | null;
  gpuKvBytes: number | null;
  cpuBytes: number | null;
  gpuBytes: number | null;
  modelAndKvBytes: number | null;
  notes: string[];
};

export function gpuLayerMaximum(model: CatalogModel, fallback = 128): number {
  if (model.gpuLayerCount !== null && model.gpuLayerCount > 0) {
    return model.gpuLayerCount;
  }
  return fallback;
}

export function normalizedGpuLayers(
  model: CatalogModel,
  value: number | null,
): number | null {
  if (value === null) return null;

  const rounded = Math.max(0, Math.round(value));
  if (model.gpuLayerCount === null || model.gpuLayerCount <= 0) {
    return rounded;
  }

  return Math.min(rounded, model.gpuLayerCount);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

type Placement = { cpu: number; gpu: number };

function weightPlacement(model: CatalogModel, gpuLayers: number | null): Placement | null {
  const profile = model.memoryProfile;
  if (!profile || gpuLayers === null || profile.layerBytes.length === 0) return null;
  const activeLayers = profile.activeLayerCount ?? profile.layerBytes.length;
  if (
    profile.layerBytes.length !== model.gpuLayerCount ||
    !Number.isSafeInteger(activeLayers) || activeLayers < 1 || activeLayers > profile.layerBytes.length ||
    !profile.layerBytes.every((value) => Number.isSafeInteger(value) && value >= 0) ||
    ![profile.sharedBytes, profile.outputBytes, profile.storedBytes]
      .every((value) => Number.isSafeInteger(value) && value >= 0) ||
    sum(profile.layerBytes) + profile.sharedBytes + profile.outputBytes !== profile.storedBytes ||
    profile.storedBytes > model.sizeBytes
  ) return null;

  // Tied output weights are copied from token embeddings for GPU output
  // offloading. The CPU-mapped input embedding remains separately resident.
  const tiedEmbedding = !profile.hasOutputTensor ? profile.tokenEmbeddingBytes ?? 0 : 0;
  if (gpuLayers > 0 && !profile.hasOutputTensor && tiedEmbedding === 0 && profile.outputBytes === 0) return null;

  const layerCount = profile.layerBytes.length;
  // The pinned b11429 runtime counts the output layer first, then the last
  // N - 1 repeating layers. Verified with 1- and 2-layer CUDA startup logs.
  const repeatingGpuLayers = Math.min(layerCount, Math.max(0, gpuLayers - 1));
  const gpuStart = layerCount - repeatingGpuLayers;
  // Keep the GGUF block numbering when an MTP companion block is present:
  // llama.cpp still counts its slot in the offload range, even if normal
  // inference does not allocate that block's tensors.
  const offloadedLayers = sum(profile.layerBytes.slice(gpuStart, activeLayers));
  const gpu = offloadedLayers + (gpuLayers > 0 ? profile.outputBytes + tiedEmbedding : 0);
  const activeStoredBytes = profile.storedBytes - sum(profile.layerBytes.slice(activeLayers));
  const cpu = activeStoredBytes - offloadedLayers - (gpuLayers > 0 ? profile.outputBytes : 0);
  if (cpu < 0 || cpu + gpu !== activeStoredBytes + (gpuLayers > 0 ? tiedEmbedding : 0)) return null;
  return { cpu, gpu };
}

type LoadOptions = {
  gpuLayers: number | null;
  context: number | null;
  kvOffload: boolean;
  keyType: string;
  valueType: string;
  unknownArgs: boolean;
};

function effectiveOptions(config: ModelConfig): LoadOptions {
  const settings: LoadOptions = {
    gpuLayers: config.gpuLayers,
    context: config.contextSize,
    kvOffload: config.kvCacheOffload,
    keyType: "f16",
    valueType: "f16",
    unknownArgs: false,
  };

  const valueFlags = new Set([
    "--gpu-layers", "-ngl", "--n-gpu-layers", "--ctx-size", "-c",
    "--cache-type-k", "-ctk", "--cache-type-v", "-ctv",
  ]);
  const args = config.extraArgs;
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    const equals = raw.indexOf("=");
    const flag = equals < 0 ? raw : raw.slice(0, equals);
    if (flag === "--no-kv-offload") {
      settings.kvOffload = false;
      continue;
    }
    if (flag === "--kv-offload") {
      settings.kvOffload = true;
      continue;
    }
    if (!valueFlags.has(flag)) {
      settings.unknownArgs = true;
      continue;
    }
    const value = equals >= 0 ? raw.slice(equals + 1) : args[++i];
    if (!value) {
      settings.unknownArgs = true;
      continue;
    }
    if (flag === "--cache-type-k" || flag === "-ctk") {
      settings.keyType = value.toLowerCase();
    } else if (flag === "--cache-type-v" || flag === "-ctv") {
      settings.valueType = value.toLowerCase();
    } else {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 0) {
        settings.unknownArgs = true;
        continue;
      }
      if (flag === "--ctx-size" || flag === "-c") settings.context = number || null;
      else settings.gpuLayers = number;
    }
  }
  return settings;
}

function cacheLayerBytes(width: number, context: number, type: CacheType): number | null {
  if (!Number.isSafeInteger(width) || width <= 0 || width % type.block !== 0) return null;
  const bytes = context * (width / type.block) * type.bytes;
  return Number.isSafeInteger(bytes) ? bytes : null;
}

function kvPlacement(
  model: CatalogModel,
  options: LoadOptions,
  flashAttention: boolean,
): Placement | null {
  const layers = model.gpuLayerCount;
  const heads = model.attentionHeadCount;
  const kvHeads = model.attentionHeadCountKv ?? heads;
  const profile = model.memoryProfile;
  const cacheLayers = profile?.cacheLayers;
  const perLayerCache = cacheLayers && cacheLayers.length > 0 ? cacheLayers : null;
  if (
    (!perLayerCache && !HOMOGENEOUS_ATTENTION.has(model.architecture.toLowerCase())) ||
    layers === null || layers <= 0 ||
    heads === null || heads <= 0 ||
    (!perLayerCache && (kvHeads === null || kvHeads <= 0)) ||
    options.gpuLayers === null ||
    options.context === null || options.context <= 0 ||
    (perLayerCache !== null && perLayerCache.length !== (profile?.activeLayerCount ?? layers))
  ) return null;

  const keyType = CACHE_TYPES[options.keyType];
  const valueType = CACHE_TYPES[options.valueType];
  if (!keyType || !valueType) return null;

  const baseWidth = model.embeddingLength !== null ? model.embeddingLength / heads : null;
  const keyLength = model.attentionKeyLength ?? baseWidth;
  const valueLength = model.attentionValueLength ?? baseWidth;
  if (
    keyLength === null || valueLength === null ||
    !Number.isSafeInteger(keyLength) || !Number.isSafeInteger(valueLength)
  ) return null;

  // llama.cpp rounds the KV allocation to a backend/attention-dependent cell
  // count. This does not include output or compute buffers.
  const padding = flashAttention ? 256 : 32;
  const context = Math.ceil(options.context / padding) * padding;
  const actualLayers = perLayerCache?.length ?? layers;
  const gpuLayers = options.kvOffload
    ? Math.min(layers, Math.max(0, options.gpuLayers - 1))
    : 0;
  let cpu = 0;
  let gpu = 0;
  for (let index = 0; index < actualLayers; index += 1) {
    const cache = perLayerCache?.[index];
    const layerHeads = cache?.kvHeads ?? kvHeads;
    if (layerHeads === null || !Number.isSafeInteger(layerHeads) || layerHeads < 0) return null;
    const keyBytes = layerHeads ? cacheLayerBytes(layerHeads * keyLength, context, keyType) : 0;
    const valueBytes = layerHeads ? cacheLayerBytes(layerHeads * valueLength, context, valueType) : 0;
    if (keyBytes === null || valueBytes === null) return null;
    const recurrentBytes = cache?.recurrentBytes ?? 0;
    if (!Number.isSafeInteger(recurrentBytes) || recurrentBytes < 0) return null;
    const bytes = keyBytes + valueBytes + recurrentBytes;
    if (index >= layers - gpuLayers) gpu += bytes;
    else cpu += bytes;
  }
  return Number.isSafeInteger(cpu) && Number.isSafeInteger(gpu) ? { cpu, gpu } : null;
}

function addKnown(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left + right;
}

export function estimateModelMemory(
  model: CatalogModel,
  config: ModelConfig,
  draftModel?: CatalogModel | null,
): ModelMemoryEstimate {
  const notes: string[] = [];
  const options = effectiveOptions(config);
  const mainWeights = weightPlacement(model, options.gpuLayers);
  if (!mainWeights) notes.push("Weight placement unavailable: incomplete GGUF tensor profile or automatic GPU offload.");

  const hasDraft = config.speculativeMode === "draft";
  const draftWeights = hasDraft && draftModel
    ? weightPlacement(draftModel, config.draftGpuLayers)
    : { cpu: 0, gpu: 0 };
  if (hasDraft) {
    if (!draftWeights) notes.push("Draft model weight placement unavailable.");
    notes.push("Draft-model KV cache is excluded.");
  }
  const cpuWeights = addKnown(mainWeights?.cpu ?? null, draftWeights?.cpu ?? null);
  const gpuWeights = addKnown(mainWeights?.gpu ?? null, draftWeights?.gpu ?? null);

  const kv = model.category === "LLM" || perLayerCacheArchitecture(model.architecture)
    ? kvPlacement(model, options, config.flashAttention)
    : { cpu: 0, gpu: 0 };
  if (!kv) notes.push("KV estimate unavailable for this architecture, context, or cache type.");
  if (options.unknownArgs) notes.push("Custom llama.cpp arguments may change memory placement or allocation.");
  if (options.gpuLayers !== null && options.gpuLayers > 0) {
    notes.push("Assumes the requested GPU offload; runtime CPU fallback may change placement.");
  }

  const cpuBytes = addKnown(cpuWeights, kv?.cpu ?? null);
  const gpuBytes = addKnown(gpuWeights, kv?.gpu ?? null);
  return {
    cpuWeightsBytes: cpuWeights,
    gpuWeightsBytes: gpuWeights,
    cpuKvBytes: kv?.cpu ?? null,
    gpuKvBytes: kv?.gpu ?? null,
    cpuBytes,
    gpuBytes,
    modelAndKvBytes: addKnown(cpuBytes, gpuBytes),
    notes,
  };
}

export function formatMemoryBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "N/A";
  return `${(bytes / GIB).toFixed(2)} GiB`;
}
