import type { ModelMemoryProfile } from "../../lib/tauri";

export type ModelCategory = "LLM" | "Embedding" | "Drafter" | "DECISION";

export function modelFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function modelDisplayName(path: string): string {
  return modelFileName(path).replace(/\.gguf$/i, "");
}

export function modelFolderPath(path: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return separator >= 0 ? path.slice(0, separator) : "";
}

function normalizedModelPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  const withoutVerbatimPrefix = normalized.startsWith("//?/unc/")
    ? `//${normalized.slice(8)}`
    : normalized.startsWith("//?/")
      ? normalized.slice(4)
      : normalized;
  return withoutVerbatimPrefix.replace(/\/+$/, "");
}

export function sameModelPath(left: string, right: string): boolean {
  return normalizedModelPath(left) === normalizedModelPath(right);
}

export function modelIsInFolder(path: string, folder: string): boolean {
  return normalizedModelPath(path).startsWith(`${normalizedModelPath(folder)}/`);
}

export type CatalogModel = {
  memoryProfile: ModelMemoryProfile | null;
  id: string;
  name: string;
  path: string;
  publisher: string;
  category: ModelCategory;
  architecture: string;
  parameters: string;
  contextLength: string;
  contextTokens: number | null;
  sizeBytes: number;
  gpuLayerCount: number | null;
  embeddingLength: number | null;
  attentionHeadCount: number | null;
  attentionHeadCountKv: number | null;
  attentionKeyLength: number | null;
  attentionValueLength: number | null;
  poolingType: string | null;
  quantization: string;
  size: string;
  modified: string;
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


export function compatibleDraftModels(
  target: CatalogModel,
  models: CatalogModel[],
): CatalogModel[] {
  const fingerprint = target.tokenizerFingerprint;
  if (!fingerprint || target.category !== "LLM") return [];

  return models.filter(
    (candidate) =>
      candidate.path !== target.path &&
      (candidate.category === "Drafter" || candidate.category === "LLM") &&
      candidate.tokenizerFingerprint === fingerprint,
  );
}
