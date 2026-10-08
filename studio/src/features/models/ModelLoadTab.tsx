import {
  Cpu,
  Layers3,
  MessageSquareText,
  Workflow,
} from "lucide-react";
import { CollapsibleSection } from "../../components/ui/CollapsibleSection";
import { Dropdown } from "../../components/ui/Dropdown";
import { InputField } from "../../components/ui/InputField";
import { Switch } from "../../components/ui/Switch";
import { TextAreaField } from "../../components/ui/TextAreaField";
import type {
  ModelConfig,
  SpeculativeMode,
} from "../../lib/config";

type Props = {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
};

const SPECULATIVE_OPTIONS: {
  label: string;
  value: SpeculativeMode;
}[] = [
  { label: "Disabled", value: "none" },
  { label: "MTP", value: "mtp" },
  { label: "Draft model", value: "draft" },
];

export function ModelLoadTab({ config, onChange }: Props) {
  function update(patch: Partial<ModelConfig>) {
    onChange({
      ...config,
      ...patch,
    });
  }

  return (
    <div className="model-inspector-tab">
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
            value={config.gpuLayers ?? ""}
            onChange={(event) =>
              update({
                gpuLayers: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

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

      <CollapsibleSection title="Speculative Decoding" icon={Workflow}>
        <div className="inspector-control-stack">
          <div className="inspector-control-row">
            <span>Mode</span>
            <Dropdown
              ariaLabel="Speculative decoding mode"
              value={config.speculativeMode}
              options={SPECULATIVE_OPTIONS}
              onChange={(speculativeMode) => update({ speculativeMode })}
            />
          </div>

          {config.speculativeMode !== "none" ? (
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

          {config.speculativeMode === "draft" ? (
            <>
              <InputField
                label="Draft Model Path"
                type="text"
                value={config.draftModelPath}
                placeholder="D:\models\draft-model.gguf"
                onChange={(event) =>
                  update({ draftModelPath: event.target.value })
                }
              />

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
            </>
          ) : null}
        </div>
      </CollapsibleSection>

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
    </div>
  );
}
