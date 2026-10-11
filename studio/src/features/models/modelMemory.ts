import type { ModelConfig } from "../../lib/config";
import type { CatalogModel } from "./types";

const BYTES_PER_F16 = 2;
const GIB = 1024 ** 3;

export type ModelMemoryEstimate = {
  gpuBytes: number;
  totalBytes: number;
  kvCacheBytes: number;
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

function gpuWeightBytes(model: CatalogModel, gpuLayers: number | null): number {
  if (model.sizeBytes <= 0) return 0;

  const layerCount = model.gpuLayerCount;
  const selected = normalizedGpuLayers(model, gpuLayers);

  if (selected === null) {
    return 0;
  }

  if (layerCount === null || layerCount <= 0) {
    return selected > 0 ? model.sizeBytes : 0;
  }

  const fraction = Math.min(1, Math.max(0, selected / layerCount));
  return model.sizeBytes * fraction;
}

export function estimateKvCacheBytes(
  model: CatalogModel,
  contextSize: number | null,
): number {
  const context = contextSize ?? model.contextTokens ?? 0;
  const layers = model.gpuLayerCount ?? 0;
  const embeddingLength = model.embeddingLength ?? 0;
  const attentionHeads = model.attentionHeadCount ?? 0;
  const kvHeads = model.attentionHeadCountKv ?? attentionHeads;

  if (
    context <= 0 ||
    layers <= 0 ||
    embeddingLength <= 0 ||
    attentionHeads <= 0 ||
    kvHeads <= 0
  ) {
    return 0;
  }

  const defaultHeadLength = embeddingLength / attentionHeads;
  const keyLength = model.attentionKeyLength ?? defaultHeadLength;
  const valueLength = model.attentionValueLength ?? defaultHeadLength;

  if (
    !Number.isFinite(keyLength) ||
    !Number.isFinite(valueLength) ||
    keyLength <= 0 ||
    valueLength <= 0
  ) {
    return 0;
  }

  return (
    context *
    layers *
    kvHeads *
    (keyLength + valueLength) *
    BYTES_PER_F16
  );
}

export function estimateModelMemory(
  model: CatalogModel,
  config: ModelConfig,
  draftModel?: CatalogModel | null,
): ModelMemoryEstimate {
  const kvCacheBytes = estimateKvCacheBytes(model, config.contextSize);
  const mainGpuWeights = gpuWeightBytes(model, config.gpuLayers);

  const draftTotalBytes =
    config.speculativeMode === "draft" && draftModel ? draftModel.sizeBytes : 0;
  const draftGpuWeights =
    config.speculativeMode === "draft" && draftModel
      ? gpuWeightBytes(draftModel, config.draftGpuLayers)
      : 0;

  return {
    gpuBytes:
      mainGpuWeights +
      draftGpuWeights +
      (config.kvCacheOffload ? kvCacheBytes : 0),
    totalBytes: model.sizeBytes + draftTotalBytes + kvCacheBytes,
    kvCacheBytes,
  };
}

export function formatMemoryBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0.00 GB";
  }

  return `${(bytes / GIB).toFixed(2)} GB`;
}
