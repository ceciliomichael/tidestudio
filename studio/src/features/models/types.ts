export type ModelCategory = "LLM" | "Embedding" | "Drafter" | "DECISION";

export type CatalogModel = {
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
