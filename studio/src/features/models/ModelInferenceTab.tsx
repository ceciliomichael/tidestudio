import {
  BrainCircuit,
  MessageSquareText,
  SlidersHorizontal,
} from "lucide-react";
import { CollapsibleSection } from "../../components/ui/CollapsibleSection";
import { Dropdown } from "../../components/ui/Dropdown";
import { InputField } from "../../components/ui/InputField";
import { Switch } from "../../components/ui/Switch";
import { TextAreaField } from "../../components/ui/TextAreaField";
import type {
  ModelConfig,
  ReasoningEffort,
} from "../../lib/config";
import type { CatalogModel } from "./types";

type Props = {
  model: CatalogModel;
  config: ModelConfig;
  runtimeLoaded?: boolean;
  onChange: (config: ModelConfig) => void;
};

const REASONING_EFFORT_OPTIONS: {
  label: string;
  value: ReasoningEffort;
}[] = [
  { label: "Default", value: "default" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "XHigh", value: "xhigh" },
  { label: "Max", value: "max" },
];

export function ModelInferenceTab({
  model,
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

  if (model.category !== "LLM") {
    return (
      <div className="model-inspector-tab">
        <p className="inspector-helper-copy">
          Chat-generation inference settings apply to LLM models.
        </p>
      </div>
    );
  }

  return (
    <div className="model-inspector-tab">
      {runtimeLoaded ? (
        <p className="inspector-helper-copy">
          Inference defaults apply to new requests immediately without reloading
          the model.
        </p>
      ) : null}
      <CollapsibleSection title="Prompt" icon={MessageSquareText}>
        <div className="inspector-control-stack">
          <TextAreaField
            label="System Prompt"
            rows={5}
            value={config.systemPrompt}
            placeholder="You are a helpful assistant."
            hint="Stored as the model's request default. It is not a server launch flag."
            onChange={(event) =>
              update({ systemPrompt: event.target.value })
            }
          />

        </div>
      </CollapsibleSection>

      {model.supportsReasoning ? (
        <CollapsibleSection title="Reasoning" icon={BrainCircuit}>
          <div className="inspector-control-stack">
            <div className="inspector-control-row">
              <span>Enable Thinking</span>
              <Switch
                className="tide-switch"
                checked={config.thinkingEnabled}
                label="Enable thinking"
                onChange={(thinkingEnabled) => update({ thinkingEnabled })}
              />
            </div>

            {config.thinkingEnabled ? (
              <>
                <div className="inspector-control-row">
                  <span>Reasoning Effort</span>
                  <Dropdown
                    ariaLabel="Reasoning effort"
                    value={config.reasoningEffort}
                    options={REASONING_EFFORT_OPTIONS}
                    onChange={(reasoningEffort) =>
                      update({ reasoningEffort })
                    }
                  />
                </div>

                <InputField
                  label="Reasoning Budget"
                  layout="inline"
                  compact
                  type="number"
                  min={-1}
                  value={config.reasoningBudget ?? ""}
                  onChange={(event) =>
                    update({
                      reasoningBudget: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />

                <div className="inspector-control-row">
                  <span>Preserve Reasoning</span>
                  <Switch
                    className="tide-switch"
                    checked={config.reasoningPreserve}
                    label="Preserve reasoning"
                    onChange={(reasoningPreserve) =>
                      update({ reasoningPreserve })
                    }
                  />
                </div>
              </>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Sampling" icon={SlidersHorizontal}>
        <div className="inspector-control-stack">
          <InputField
            label="Temperature"
            layout="inline"
            compact
            type="number"
            min={0}
            step={0.05}
            value={config.temperature ?? ""}
            onChange={(event) =>
              update({
                temperature: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Top K"
            layout="inline"
            compact
            type="number"
            min={0}
            value={config.topK ?? ""}
            onChange={(event) =>
              update({
                topK: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Top P"
            layout="inline"
            compact
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.topP ?? ""}
            onChange={(event) =>
              update({
                topP: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Min P"
            layout="inline"
            compact
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.minP ?? ""}
            onChange={(event) =>
              update({
                minP: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Typical P"
            layout="inline"
            compact
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.typicalP ?? ""}
            onChange={(event) =>
              update({
                typicalP: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Seed"
            layout="inline"
            compact
            type="number"
            value={config.seed ?? ""}
            onChange={(event) =>
              update({
                seed: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Repeat Penalty"
            layout="inline"
            compact
            type="number"
            min={0}
            step={0.01}
            value={config.repeatPenalty ?? ""}
            onChange={(event) =>
              update({
                repeatPenalty: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Presence Penalty"
            layout="inline"
            compact
            type="number"
            step={0.01}
            value={config.presencePenalty ?? ""}
            onChange={(event) =>
              update({
                presencePenalty: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />

          <InputField
            label="Frequency Penalty"
            layout="inline"
            compact
            type="number"
            step={0.01}
            value={config.frequencyPenalty ?? ""}
            onChange={(event) =>
              update({
                frequencyPenalty: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
