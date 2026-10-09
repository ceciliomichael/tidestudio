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
  quantization: string;
  size: string;
  modified: string;
  chatTemplate: string | null;
  supportsMtp: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
};
