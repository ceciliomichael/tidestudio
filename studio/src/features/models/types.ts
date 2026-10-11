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
  poolingType: string | null;
  quantization: string;
  size: string;
  modified: string;
  chatTemplate: string | null;
  supportsMtp: boolean;
  supportsReasoning: boolean;
  supportsThinkingToggle: boolean;
  supportsReasoningEffort: boolean;
  supportsReasoningPreserve: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
};
