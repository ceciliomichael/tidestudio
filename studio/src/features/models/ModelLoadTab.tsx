import {
  Cpu,
  Database,
  Layers3,
  MessageSquareText,
  Workflow,
} from "lucide-react";
import type { CSSProperties } from "react";
import { CollapsibleSection } from "../../components/ui/CollapsibleSection";
import {
  Dropdown,
  type DropdownOption,
} from "../../components/ui/Dropdown";
import { InputField } from "../../components/ui/InputField";
import { Switch } from "../../components/ui/Switch";
import { TextAreaField } from "../../components/ui/TextAreaField";
import type {
  EmbeddingPooling,
  ModelConfig,
  SpeculativeMode,
} from "../../lib/config";
import { gpuLayerMaximum, normalizedGpuLayers } from "./modelMemory";
import { compatibleDraftModels, type CatalogModel } from "./types";

type Props = {
  model: CatalogModel;
  availableModels: CatalogModel[];
  config: ModelConfig;
  runtimeLoaded?: boolean;
  onChange: (config: ModelConfig) => void;
};

const EMBEDDING_POOLING_OPTIONS: DropdownOption<EmbeddingPooling>[] = [
  { label: "Model default", value: "model" },
  { label: "Mean", value: "mean" },
  { label: "CLS", value: "cls" },
  { label: "Last token", value: "last" },
];

function rangeProgressStyle(value: number, max: number): CSSProperties {
  const progress = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return { "--range-progress": `${progress}%` } as CSSProperties;
}

export function ModelLoadTab({
  model,
  availableModels,
  config,
  runtimeLoaded = false,
  onChange,
}: Props) {
  function update(patch: Partial<ModelConfig>) {
    onChange({
      ...config,
      ...patch,
    });
  }

  const isLlm = model.category === "LLM";
  const isReranker =
    model.category === "Embedding" && model.poolingType === "rank";
  const isEmbedding = model.category === "Embedding" && !isReranker;
  const speculativeOptions: DropdownOption<SpeculativeMode>[] = [
    { label: "Disabled", value: "none" },
    ...(model.supportsMtp
      ? [{ label: "MTP", value: "mtp" as const }]
      : []),
    { label: "Draft model", value: "draft" },
  ];
  const speculativeMode =
    config.speculativeMode === "mtp" && !model.supportsMtp
      ? "none"
      : config.speculativeMode;
  const gpuMax = gpuLayerMaximum(model);
  const displayedGpuLayers = normalizedGpuLayers(model, config.gpuLayers);
  const compatibleDrafts = compatibleDraftModels(model, availableModels);
  const selectedDraftIsCompatible = compatibleDrafts.some(
    (candidate) => candidate.path === config.draftModelPath,
  );
  const draftModelOptions: DropdownOption<string>[] = [
    ...(!selectedDraftIsCompatible
      ? [{ label: "Select compatible model", value: "" }]
      : []),
    ...compatibleDrafts.map((candidate) => ({
      label: candidate.name,
      value: candidate.path,
      badge: candidate.category === "Drafter" ? "Drafter" : candidate.quantization,
    })),
  ];

  function changeSpeculativeMode(nextMode: SpeculativeMode) {
    update({
      speculativeMode: nextMode,
      ...(nextMode === "draft" && !selectedDraftIsCompatible
        ? { draftModelPath: compatibleDrafts[0]?.path ?? "" }
        : {}),
    });
  }

  if (model.category === "Drafter") {
    return (
      <div className="model-inspector-tab">
        <p className="inspector-helper-copy">
          Drafter models are configured from the target LLM&apos;s Load &gt;
          Speculative Decoding section. The target owns the draft model selection,
          draft GPU offload, and draft token limits.
        </p>
      </div>
    );
  }

  return (
    <div className="model-inspector-tab">
      {runtimeLoaded ? (
        <p className="inspector-helper-copy">
          Load settings are saved for this GGUF and apply the next time the model
          is loaded.
        </p>
      ) : null}
      {isEmbedding ? (
        <p className="inspector-helper-copy">
          Embedding models use embedding mode and pooled vector output. Chat
          templates, reasoning, sampling, and speculative decoding do not apply.
        </p>
      ) : null}
      {isReranker ? (
        <p className="inspector-helper-copy">
          This GGUF reports rank pooling, which identifies a reranking model.
          TideStudio does not expose a public reranking endpoint yet, so
          embedding pooling and chat-generation settings are intentionally
          hidden.
        </p>
      ) : null}
      {model.category === "DECISION" ? (
        <p className="inspector-helper-copy">
          Decision models use typed decision inference rather than token
          generation. Chat templates and speculative decoding do not apply.
        </p>
      ) : null}
      <CollapsibleSection title="Context and Offload" icon={Cpu}>
        <div className="inspector-control-stack">
          <InputField
            label="Context Length"
            layout="inline"
            compact
            type="number"
            min={1}
            value={config.contextSize ?? ""}
            onChange={(event) =>
              update({
                contextSize: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="GPU Offload"
            layout="inline"
            compact
            type="number"
            min={0}
            max={gpuMax}
            value={displayedGpuLayers ?? ""}
            onChange={(event) =>
              update({
                gpuLayers: event.target.value
                  ? normalizedGpuLayers(model, Number(event.target.value))
                  : null,
              })
            }
          />
          <input
            className="model-load__range"
            aria-label="GPU Offload slider"
            type="range"
            min={0}
            max={gpuMax}
            value={Math.max(0, displayedGpuLayers ?? 0)}
            style={rangeProgressStyle(Math.max(0, displayedGpuLayers ?? 0), gpuMax)}
            onChange={(event) =>
              update({ gpuLayers: Number(event.target.value) })
            }
          />
          <p className="inspector-control-hint model-load__gpu-layer-hint">
            {model.gpuLayerCount !== null
              ? `0–${model.gpuLayerCount.toLocaleString()} model layers`
              : "Layer metadata unavailable; using a fallback slider range"}
          </p>

          <div className="inspector-control-row">
            <span>Flash Attention</span>
            <Switch
              className="tide-switch"
              checked={config.flashAttention}
              label="Flash attention"
              onChange={(flashAttention) => update({ flashAttention })}
            />
          </div>
        </div>
      </CollapsibleSection>

      {isEmbedding ? (
        <CollapsibleSection title="Embedding Output" icon={Database}>
          <div className="inspector-control-stack">
            <div className="inspector-control-row">
              <span>Pooling</span>
              <Dropdown
                ariaLabel="Embedding pooling"
                value={config.embeddingPooling}
                options={EMBEDDING_POOLING_OPTIONS}
                onChange={(embeddingPooling) => update({ embeddingPooling })}
              />
            </div>
            <p className="inspector-control-hint">
              {model.poolingType && model.poolingType !== "none"
                ? `GGUF pooling metadata: ${model.poolingType}.`
                : "OpenAI-compatible embeddings require pooled output. Use Mean, CLS, or Last token if the model default is unpooled."}
            </p>
          </div>
        </CollapsibleSection>
      ) : null}

      {isLlm ? (
        <CollapsibleSection title="Speculative Decoding" icon={Workflow}>
          <div className="inspector-control-stack">
            <div className="inspector-control-row model-load__speculative-mode">
              <span>Mode</span>
              <Dropdown
                ariaLabel="Speculative decoding mode"
                value={speculativeMode}
                options={speculativeOptions}
                onChange={changeSpeculativeMode}
              />
            </div>

            {speculativeMode === "draft" ? (
              compatibleDrafts.length ? (
                <div className="inspector-control-row model-load__draft-model">
                  <span>Draft Model</span>
                  <Dropdown
                    ariaLabel="Compatible draft model"
                    value={selectedDraftIsCompatible ? config.draftModelPath : ""}
                    options={draftModelOptions}
                    onChange={(draftModelPath) => update({ draftModelPath })}
                  />
                </div>
              ) : (
                <p className="inspector-control-hint model-load__draft-model-empty">
                  No installed model has a matching tokenizer and vocabulary fingerprint.
                </p>
              )
            ) : null}

            {speculativeMode !== "none" ? (
              <>
                <InputField
                  label="Max Draft Tokens"
                  layout="inline"
                  compact
                  type="number"
                  min={1}
                  value={config.draftMaxTokens ?? ""}
                  onChange={(event) =>
                    update({
                      draftMaxTokens: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />

                <InputField
                  label="Min Draft Tokens"
                  layout="inline"
                  compact
                  type="number"
                  min={0}
                  value={config.draftMinTokens ?? ""}
                  onChange={(event) =>
                    update({
                      draftMinTokens: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />

                <InputField
                  label="Draft Min Probability"
                  layout="inline"
                  compact
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.draftMinProbability ?? ""}
                  onChange={(event) =>
                    update({
                      draftMinProbability: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </>
            ) : null}

            {speculativeMode === "draft" ? (
              <>
                <InputField
                  label="Draft GPU Layers"
                  layout="inline"
                  compact
                  type="number"
                  value={config.draftGpuLayers ?? ""}
                  onChange={(event) =>
                    update({
                      draftGpuLayers: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
                <p className="inspector-control-hint">
                  Only installed models with an exact tokenizer metadata fingerprint match are selectable.
                </p>
              </>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Advanced" icon={Layers3}>
        <div className="inspector-control-stack">
          <InputField
            label="llama.cpp Arguments Override"
            type="text"
            value={config.extraArgs.join(" ")}
            placeholder="--threads 12"
            onChange={(event) =>
              update({
                extraArgs: event.target.value.trim()
                  ? event.target.value.trim().split(/\s+/)
                  : [],
              })
            }
          />
        </div>
      </CollapsibleSection>

      {isLlm ? (
        <CollapsibleSection title="Prompt Template" icon={MessageSquareText}>
          <div className="inspector-control-stack">
            <TextAreaField
              label="Template Override"
              rows={6}
              value={config.chatTemplate}
              placeholder="Use GGUF model default"
              hint="Prefilled from GGUF metadata when available. Edit it to override the model default."
              onChange={(event) =>
                update({ chatTemplate: event.target.value })
              }
            />
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
