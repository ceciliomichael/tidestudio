import { describe, expect, it } from "vitest";
import { createDefaultModelConfig } from "../../lib/config";
import { estimateModelMemory, formatMemoryBytes } from "./modelMemory";
import type { CatalogModel } from "./types";

const GiB = 1024 ** 3;

function makeModel(overrides: Partial<CatalogModel> = {}): CatalogModel {
  return {
    id: "test",
    name: "Test GGUF",
    path: "test.gguf",
    publisher: "Local",
    category: "LLM",
    architecture: "qwen3",
    parameters: "7B",
    contextLength: "8k",
    contextTokens: 8192,
    sizeBytes: 540,
    gpuLayerCount: 3,
    embeddingLength: 128,
    attentionHeadCount: 4,
    attentionHeadCountKv: 2,
    attentionKeyLength: 32,
    attentionValueLength: 32,
    memoryProfile: {
      layerBytes: [100, 110, 120],
      sharedBytes: 150,
      outputBytes: 60,
      storedBytes: 540,
      hasOutputTensor: true,
    },
    poolingType: null,
    quantization: "Q4_K_M",
    size: "540 B",
    modified: "Today",
    chatTemplate: null,
    tokenizerFingerprint: null,
    supportsMtp: false,
    supportsReasoning: false,
    supportsThinkingToggle: false,
    supportsReasoningEffort: false,
    supportsReasoningPreserve: false,
    supportsVision: false,
    supportsTools: false,
    ...overrides,
  };
}

describe("model memory estimates", () => {
  it("keeps all weights and KV on CPU with no GPU layers", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 0,
      contextSize: 256,
    });
    expect(estimate.gpuBytes).toBe(0);
    expect(estimate.cpuWeightsBytes).toBe(540);
    expect(estimate.cpuKvBytes).toBe(256 * 3 * 2 * 32 * 2 * 2);
    expect(estimate.modelAndKvBytes).toBe(estimate.cpuBytes);
  });

  it("places the last repeating layers and matching KV on the GPU", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 2,
      contextSize: 256,
    });
    expect(estimate.gpuWeightsBytes).toBe(180);
    expect(estimate.cpuWeightsBytes).toBe(360);
    expect(estimate.gpuKvBytes).toBe(256 * 1 * 2 * 32 * 2 * 2);
    expect(estimate.cpuKvBytes).toBe(256 * 2 * 2 * 32 * 2 * 2);
  });

  it("offloads only the output layer at GPU count one on the pinned runtime", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 1,
      contextSize: 256,
    });
    expect(estimate.gpuWeightsBytes).toBe(60);
    expect(estimate.gpuKvBytes).toBe(0);
  });

  it("keeps KV on CPU when KV offload is disabled", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 2,
      contextSize: 256,
      kvCacheOffload: false,
    });
    expect(estimate.gpuKvBytes).toBe(0);
    expect(estimate.cpuKvBytes).toBe(256 * 3 * 2 * 32 * 2 * 2);
  });

  it("updates the compact GPU and Total values as context length changes", () => {
    const config = { ...createDefaultModelConfig(), gpuLayers: 2 };
    const shorter = estimateModelMemory(makeModel(), { ...config, contextSize: 256 });
    const longer = estimateModelMemory(makeModel(), { ...config, contextSize: 512 });
    expect(longer.gpuBytes).toBeGreaterThan(shorter.gpuBytes!);
    expect(longer.modelAndKvBytes).toBeGreaterThan(shorter.modelAndKvBytes!);
    expect(longer.modelAndKvBytes! - shorter.modelAndKvBytes!).toBe(
      256 * 3 * 2 * 32 * 2 * 2,
    );
  });

  it("accounts for one-token context increases at a KV allocation boundary", () => {
    const config = { ...createDefaultModelConfig(), gpuLayers: 2 };
    const before = estimateModelMemory(makeModel(), { ...config, contextSize: 256 });
    const after = estimateModelMemory(makeModel(), { ...config, contextSize: 257 });
    expect(after.gpuBytes).toBeGreaterThan(before.gpuBytes!);
    expect(after.modelAndKvBytes).toBeGreaterThan(before.modelAndKvBytes!);
  });

  it("updates GPU usage when offload changes without inflating Total memory", () => {
    const config = { ...createDefaultModelConfig(), contextSize: 512 };
    const cpuOnly = estimateModelMemory(makeModel(), { ...config, gpuLayers: 0 });
    const partiallyOffloaded = estimateModelMemory(makeModel(), { ...config, gpuLayers: 2 });
    expect(partiallyOffloaded.gpuBytes).toBeGreaterThan(cpuOnly.gpuBytes!);
    expect(partiallyOffloaded.modelAndKvBytes).toBe(cpuOnly.modelAndKvBytes);
  });

  it("accounts for the distinct output tensors if full extra-layer offload is requested", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 4,
      contextSize: 256,
    });
    expect(estimate.gpuWeightsBytes).toBe(390);
    expect(estimate.cpuWeightsBytes).toBe(150);
  });

  it("handles distinct key and value quantization types from custom arguments", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 1,
      contextSize: 256,
      extraArgs: ["--cache-type-k", "q8_0", "--cache-type-v=q4_0"],
    });
    expect(estimate.gpuKvBytes).toBe(0);
    expect(estimate.cpuKvBytes).toBe(3 * 256 * (2 * 34 + 2 * 18));
  });

  it("counts draft weights separately and flags excluded draft KV memory", () => {
    const draft = makeModel({
      path: "draft.gguf",
      memoryProfile: {
        layerBytes: [20, 30, 40],
        sharedBytes: 50,
        outputBytes: 10,
        storedBytes: 150,
        hasOutputTensor: true,
      },
    });
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      gpuLayers: 1,
      contextSize: 256,
      speculativeMode: "draft",
      draftGpuLayers: 2,
    }, draft);
    expect(estimate.gpuWeightsBytes).toBe(60 + 50);
    expect(estimate.notes).toContain("Draft-model KV cache is excluded.");
  });

  it("never presents missing tensor or KV metadata as zero memory", () => {
    const model = makeModel({ memoryProfile: null, architecture: "qwen3next" });
    const estimate = estimateModelMemory(model, createDefaultModelConfig());
    expect(estimate.cpuWeightsBytes).toBeNull();
    expect(estimate.gpuKvBytes).toBeNull();
    expect(estimate.modelAndKvBytes).toBeNull();
    expect(formatMemoryBytes(null)).toBe("N/A");
  });

  it("does not guess offloaded output weights for a tied or unclassified output", () => {
    const model = makeModel({
      memoryProfile: {
        layerBytes: [100, 110, 120],
        sharedBytes: 210,
        outputBytes: 0,
        storedBytes: 540,
        hasOutputTensor: false,
      },
    });
    const gpu = estimateModelMemory(model, { ...createDefaultModelConfig(), gpuLayers: 1 });
    expect(gpu.gpuWeightsBytes).toBeNull();
    const cpu = estimateModelMemory(model, { ...createDefaultModelConfig(), gpuLayers: 0 });
    expect(cpu.cpuWeightsBytes).toBe(540);
  });

  it("estimates Qwen3.5 tied output, hybrid cache and an inactive MTP block", () => {
    const state = (2048 * 128 + (2048 + 2 * 16 * 128) * 3) * 4;
    const model = makeModel({
      architecture: "qwen35",
      gpuLayerCount: 25,
      sizeBytes: 4100,
      memoryProfile: {
        layerBytes: Array(25).fill(100),
        activeLayerCount: 24,
        cacheLayers: Array.from({ length: 24 }, (_, index) =>
          (index + 1) % 4 === 0
            ? { kvHeads: 2, recurrentBytes: 0 }
            : { kvHeads: 0, recurrentBytes: state },
        ),
        sharedBytes: 1500,
        outputBytes: 100,
        tokenEmbeddingBytes: 1000,
        storedBytes: 4100,
        hasOutputTensor: false,
      },
      attentionKeyLength: 256,
      attentionValueLength: 256,
    });
    const estimate = estimateModelMemory(model, {
      ...createDefaultModelConfig(), gpuLayers: 4, contextSize: 512,
    });
    expect(estimate.gpuWeightsBytes).toBe(1300); // tied output + blocks 22 and 23
    expect(estimate.cpuWeightsBytes).toBe(3700); // excludes the inactive MTP block
    expect(estimate.gpuKvBytes).toBe(512 * 2 * 256 * 2 * 2 + state);
    expect(estimate.cpuKvBytes).toBe(5 * 512 * 2 * 256 * 2 * 2 + 17 * state);
    expect(estimate.modelAndKvBytes).toBe(5000 + 6 * 512 * 2 * 256 * 2 * 2 + 18 * state);
  });

  it("estimates LFM2 attention layers and recurrent convolution buffers", () => {
    const recurrent = 2048 * (3 - 1) * 4;
    const model = makeModel({
      architecture: "lfm2",
      gpuLayerCount: 3,
      attentionHeadCount: 32,
      attentionHeadCountKv: null,
      embeddingLength: 2048,
      attentionKeyLength: null,
      attentionValueLength: null,
      memoryProfile: {
        layerBytes: [100, 110, 120],
        sharedBytes: 150,
        outputBytes: 60,
        storedBytes: 540,
        hasOutputTensor: true,
        cacheLayers: [
          { kvHeads: 0, recurrentBytes: recurrent },
          { kvHeads: 8, recurrentBytes: 0 },
          { kvHeads: 0, recurrentBytes: recurrent },
        ],
      },
    });
    const estimate = estimateModelMemory(model, {
      ...createDefaultModelConfig(), gpuLayers: 2, contextSize: 256,
    });
    expect(estimate.gpuKvBytes).toBe(recurrent);
    expect(estimate.cpuKvBytes).toBe(recurrent + 256 * 8 * 64 * 2 * 2);
    expect(estimate.modelAndKvBytes).not.toBeNull();
  });

  it("does not invent recurrent memory for an unknown hybrid architecture", () => {
    const model = makeModel({ architecture: "qwen35", memoryProfile: null });
    expect(estimateModelMemory(model, createDefaultModelConfig()).modelAndKvBytes).toBeNull();
  });

  it("does not assume model max context when settings are automatic", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      contextSize: null,
    });
    expect(estimate.cpuKvBytes).toBeNull();
  });

  it("flags unsupported cache types rather than inventing a number", () => {
    const estimate = estimateModelMemory(makeModel(), {
      ...createDefaultModelConfig(),
      extraArgs: ["--cache-type-k", "unknown_type"],
    });
    expect(estimate.gpuKvBytes).toBeNull();
  });

  it("shows a readable unit for known bytes", () => {
    expect(formatMemoryBytes(GiB)).toBe("1.00 GiB");
  });
});
