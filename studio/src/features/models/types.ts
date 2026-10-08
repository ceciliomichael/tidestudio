export type ModelCategory = "LLM" | "Embedding" | "Drafter";

export type CatalogModel = {
  id: string;
  name: string;
  path: string;
  publisher: string;
  category: ModelCategory;
  architecture: string;
  parameters: string;
  quantization: string;
  size: string;
  modified: string;
  chatTemplate: string | null;
  supportsReasoning: boolean;
};
