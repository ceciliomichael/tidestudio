export type CapabilityConfidence = "high" | "medium" | "low";
export type ModelSearchSource = "huggingface" | "modelscope";

export type CapabilitySignal = {
  supported: boolean;
  confidence: CapabilityConfidence;
  evidence: string[];
};

export type ModelCapabilities = {
  category: "LLM" | "Embedding" | "Drafter" | "DECISION";
  mtp: CapabilitySignal;
  reasoning: CapabilitySignal;
  vision: CapabilitySignal;
  tools: CapabilitySignal;
};

export type GgufInspection = {
  architecture: string | null;
  modelName: string | null;
  chatTemplate: string | null;
  capabilities: ModelCapabilities;
};

export type HuggingFaceModelSummary = {
  source: ModelSearchSource;
  repoId: string;
  author: string;
  downloads: number;
  likes: number;
  lastModified: string | null;
  pipelineTag: string | null;
  tags: string[];
  visionCapable: boolean;
};

export type HuggingFaceFile = {
  filename: string;
  sizeBytes: number | null;
  quantization: string | null;
  isMmproj: boolean;
  downloaded: boolean;
};

export type HuggingFaceRepoDetails = HuggingFaceModelSummary & {
  files: HuggingFaceFile[];
  readme: string | null;
};

export type DownloadProgress = {
  downloadId: string;
  repoId: string;
  filename: string;
  downloadedBytes: number;
  totalBytes: number | null;
  status: "downloading" | "completed";
};

export type DownloadActivity = DownloadProgress & {
  speedBytesPerSecond: number;
  completedAt: number | null;
};

export type DownloadedModel = {
  source: ModelSearchSource;
  repoId: string;
  filename: string;
  path: string;
  sizeBytes: number;
  inspection: GgufInspection | null;
  inspectionError: string | null;
};
