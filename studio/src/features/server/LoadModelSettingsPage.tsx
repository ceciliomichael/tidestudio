import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Dropdown, type DropdownOption } from "../../components/ui/Dropdown";
import { InputField } from "../../components/ui/InputField";
import { Switch } from "../../components/ui/Switch";
import type {
  EmbeddingPooling,
  ModelConfig,
  SpeculativeMode,
} from "../../lib/config";
import { compatibleDraftModels, type CatalogModel } from "../models/types";

type Props = {
  model: CatalogModel;
  availableModels: CatalogModel[];
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
  onCancel: () => void;
  onLoad: () => void;
};

type NumericKey =
  | "contextSize"
  | "gpuLayers"
  | "cpuThreads"
  | "batchSize"
  | "microBatchSize"
  | "parallelSlots"
  | "ropeFrequencyBase"
  | "ropeFrequencyScale";

const POOLING_OPTIONS: DropdownOption<EmbeddingPooling>[] = [
  { label: "Model default", value: "model" },
  { label: "Mean", value: "mean" },
  { label: "CLS", value: "cls" },
  { label: "Last token", value: "last" },
];

function NumberValueInput({
  value,
  min,
  max,
  step = 1,
  placeholder,
  onChange,
}: {
  value: number | null;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraftValue(value === null ? "" : String(value));
  }, [value]);

  return (
    <input
      className="load-model-settings__number"
      type="number"
      min={min}
      max={max}
      step={step}
      value={draftValue}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        setDraftValue(raw);
        if (!raw) return;
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
      onBlur={() => {
        if (!draftValue && value !== null) {
          setDraftValue(String(value));
        }
      }}
    />
  );
}

function NumericRow({
  label,
  value,
  autoValue,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number | null;
  autoValue: number;
  min: number;
  max?: number;
  step?: number | "any";
  hint?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="load-model-settings__field">
      <div className="load-model-settings__field-main">
        <label className="load-model-settings__optional-label">
          <span>{label}</span>
          <input
            type="checkbox"
            checked={value !== null}
            aria-label={`Override ${label}`}
            onChange={(event) => onChange(event.target.checked ? autoValue : null)}
          />
        </label>
        {value === null ? (
          <span className="load-model-settings__auto">Auto</span>
        ) : (
          <NumberValueInput
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
          />
        )}
      </div>
      {hint ? <p className="load-model-settings__hint">{hint}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="load-model-settings__field-main">
      <span>{label}</span>
      <Switch
        className="tide-switch"
        label={label}
        checked={checked}
        onChange={onChange}
      />
    </div>
  );
}

function contextSteps(max: number): number[] {
  const steps = [256];
  while (steps[steps.length - 1] * 2 < max) {
    steps.push(steps[steps.length - 1] * 2);
  }
  if (steps[steps.length - 1] !== max) {
    steps.push(max);
  }
  return steps;
}

function nearestStep(steps: number[], value: number): number {
  return steps.reduce(
    (nearest, current, index) =>
      Math.abs(current - value) < Math.abs(steps[nearest] - value)
        ? index
        : nearest,
    0,
  );
}

export function LoadModelSettingsPage({
  model,
  availableModels,
  config,
  onChange,
  onCancel,
  onLoad,
}: Props) {
  const isLlm = model.category === "LLM";
  const isReranker =
    model.category === "Embedding" && model.poolingType === "rank";
  const isEmbedding = model.category === "Embedding" && !isReranker;
  const isDecision = model.category === "DECISION";
  const isDrafter = model.category === "Drafter";
  const contextMax = Math.max(4096, model.contextTokens ?? 0, config.contextSize ?? 0);
  const contextOptions = useMemo(() => contextSteps(contextMax), [contextMax]);
  const gpuMax = Math.max(128, config.gpuLayers ?? 0);

  const speculativeOptions: DropdownOption<SpeculativeMode>[] = [
    { label: "Disabled", value: "none" },
    ...(model.supportsMtp ? [{ label: "MTP", value: "mtp" as const }] : []),
    { label: "Draft model", value: "draft" },
  ];
  const speculativeMode =
    config.speculativeMode === "mtp" && !model.supportsMtp
      ? "none"
      : config.speculativeMode;
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

  function update(patch: Partial<ModelConfig>) {
    onChange({ ...config, ...patch });
  }

  function updateNumeric(key: NumericKey, value: number | null) {
    update({ [key]: value });
  }

  function changeSpeculativeMode(nextMode: SpeculativeMode) {
    update({
      speculativeMode: nextMode,
      ...(nextMode === "draft" && !selectedDraftIsCompatible
        ? { draftModelPath: compatibleDrafts[0]?.path ?? "" }
        : {}),
    });
  }

  const invalid =
    ([
      ["contextSize", 1],
      ["gpuLayers", 0],
      ["cpuThreads", 1],
      ["batchSize", 1],
      ["microBatchSize", 1],
      ["parallelSlots", 1],
      ["ropeFrequencyBase", 0.000001],
      ["ropeFrequencyScale", 0.000001],
    ] as const).some(([key, min]) => {
      const value = config[key];
      return (
        value !== null &&
        (!Number.isFinite(value) ||
          value < min ||
          (key !== "ropeFrequencyBase" &&
            key !== "ropeFrequencyScale" &&
            !Number.isInteger(value)))
      );
    }) ||
    (config.batchSize !== null &&
      config.microBatchSize !== null &&
      config.microBatchSize > config.batchSize) ||
    (isLlm && speculativeMode !== "none" && (
      (config.draftMaxTokens !== null &&
        (!Number.isInteger(config.draftMaxTokens) || config.draftMaxTokens < 1)) ||
      (config.draftMinTokens !== null &&
        (!Number.isInteger(config.draftMinTokens) || config.draftMinTokens < 0)) ||
      (config.draftMinProbability !== null &&
        (!Number.isFinite(config.draftMinProbability) ||
          config.draftMinProbability < 0 || config.draftMinProbability > 1)) ||
      (config.draftMaxTokens !== null &&
        config.draftMinTokens !== null &&
        config.draftMinTokens > config.draftMaxTokens)
    )) ||
    (isLlm &&
      speculativeMode === "draft" &&
      !compatibleDrafts.some((candidate) => candidate.path === config.draftModelPath));

  return (
    <>
      <div
        className="load-model-settings__body"
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === "Enter" && !invalid && !isReranker) {
            event.preventDefault();
            onLoad();
          }
        }}
      >
        <section className="load-model-settings__section">
          <div className="load-model-settings__field">
            <label className="load-model-settings__field-main">
              <span>Context Length</span>
              <NumberValueInput
                min={1}
                max={contextMax}
                value={config.contextSize}
                placeholder="Auto"
                onChange={(value) => updateNumeric("contextSize", value)}
              />
            </label>
            {model.contextTokens ? (
              <p className="load-model-settings__hint">
                Model supports up to {model.contextTokens.toLocaleString()} tokens
              </p>
            ) : null}
            <input
              className="load-model-settings__range"
              aria-label="Context Length slider"
              type="range"
              min={0}
              max={contextOptions.length - 1}
              value={nearestStep(contextOptions, config.contextSize ?? 4096)}
              onChange={(event) =>
                updateNumeric("contextSize", contextOptions[Number(event.target.value)])
              }
            />
          </div>

          <div className="load-model-settings__field">
            <label className="load-model-settings__field-main">
              <span>GPU Offload</span>
              <NumberValueInput
                min={0}
                value={config.gpuLayers}
                placeholder="Auto"
                onChange={(value) => updateNumeric("gpuLayers", value)}
              />
            </label>
            <input
              className="load-model-settings__range"
              aria-label="GPU Offload slider"
              type="range"
              min={0}
              max={gpuMax}
              value={Math.max(0, config.gpuLayers ?? 0)}
              onChange={(event) =>
                updateNumeric("gpuLayers", Number(event.target.value))
              }
            />
          </div>

          <NumericRow
            label="CPU Thread Pool Size"
            min={1}
            value={config.cpuThreads}
            autoValue={Math.max(1, navigator.hardwareConcurrency || 1)}
            onChange={(value) => updateNumeric("cpuThreads", value)}
          />
          <NumericRow
            label="Evaluation Batch Size"
            min={1}
            value={config.batchSize}
            autoValue={2048}
            onChange={(value) => updateNumeric("batchSize", value)}
          />
          <NumericRow
            label="Physical Batch Size"
            min={1}
            value={config.microBatchSize}
            autoValue={512}
            hint="Physical batch size cannot exceed evaluation batch size when both are set."
            onChange={(value) => updateNumeric("microBatchSize", value)}
          />
          {!isDecision ? (
            <NumericRow
              label="Max Concurrent Predictions"
              min={1}
              value={config.parallelSlots}
              autoValue={4}
              onChange={(value) => updateNumeric("parallelSlots", value)}
            />
          ) : null}
          {isLlm ? (
            <>
              <ToggleRow
                label="Offload KV Cache to GPU Memory"
                checked={config.kvCacheOffload}
                onChange={(kvCacheOffload) => update({ kvCacheOffload })}
              />
              <NumericRow
                label="RoPE Frequency Base"
                min={0.000001}
                step="any"
                value={config.ropeFrequencyBase}
                autoValue={10000}
                onChange={(value) => updateNumeric("ropeFrequencyBase", value)}
              />
              <NumericRow
                label="RoPE Frequency Scale"
                min={0.000001}
                step="any"
                value={config.ropeFrequencyScale}
                autoValue={1}
                onChange={(value) => updateNumeric("ropeFrequencyScale", value)}
              />
            </>
          ) : null}
          <ToggleRow
            label="Flash Attention"
            checked={config.flashAttention}
            onChange={(flashAttention) => update({ flashAttention })}
          />
        </section>

        {isLlm ? (
          <section className="load-model-settings__section">
            <h3>Speculative Decoding</h3>
            <div className="load-model-settings__field-main load-model-settings__speculative-mode">
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
                <div className="load-model-settings__field-main load-model-settings__draft-model">
                  <span>Draft Model</span>
                  <Dropdown
                    ariaLabel="Compatible draft model"
                    value={selectedDraftIsCompatible ? config.draftModelPath : ""}
                    options={draftModelOptions}
                    onChange={(draftModelPath) => update({ draftModelPath })}
                  />
                </div>
              ) : (
                <p className="load-model-settings__hint load-model-settings__draft-empty">
                  No installed model has a matching tokenizer and vocabulary fingerprint.
                </p>
              )
            ) : null}
            {speculativeMode !== "none" ? (
              <>
                <InputField
                  label="Max Draft Tokens"
                  type="number"
                  min={1}
                  layout="inline"
                  compact
                  value={config.draftMaxTokens ?? ""}
                  onChange={(event) => update({
                    draftMaxTokens: event.target.value ? Number(event.target.value) : null,
                  })}
                />
                <InputField
                  label="Min Draft Tokens"
                  type="number"
                  min={0}
                  layout="inline"
                  compact
                  value={config.draftMinTokens ?? ""}
                  onChange={(event) => update({
                    draftMinTokens: event.target.value ? Number(event.target.value) : null,
                  })}
                />
                <InputField
                  label="Draft Min Probability"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  layout="inline"
                  compact
                  value={config.draftMinProbability ?? ""}
                  onChange={(event) => update({
                    draftMinProbability: event.target.value ? Number(event.target.value) : null,
                  })}
                />
              </>
            ) : null}
            {speculativeMode === "draft" ? (
              <>
                <InputField
                  label="Draft GPU Layers"
                  type="number"
                  layout="inline"
                  compact
                  value={config.draftGpuLayers ?? ""}
                  onChange={(event) => update({
                    draftGpuLayers: event.target.value ? Number(event.target.value) : null,
                  })}
                />
              </>
            ) : null}
          </section>
        ) : null}

        {isEmbedding ? (
          <section className="load-model-settings__section">
            <h3>Embedding Output</h3>
            <div className="load-model-settings__field-main">
              <span>Pooling</span>
              <Dropdown
                ariaLabel="Embedding pooling"
                value={config.embeddingPooling}
                options={POOLING_OPTIONS}
                onChange={(embeddingPooling) => update({ embeddingPooling })}
              />
            </div>
          </section>
        ) : null}

        {isReranker || isDrafter ? (
          <p className="load-model-settings__notice">
            {isReranker
              ? "This rank-pooling model is a reranker. TideStudio does not currently expose a reranking endpoint."
              : "Drafter models are configured from the target LLM's speculative decoding settings."}
          </p>
        ) : null}

      </div>

      <footer className="load-model-settings__footer">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          disabled={invalid || isReranker}
          onClick={onLoad}
        >
          Load Model
        </Button>
      </footer>
    </>
  );
}
