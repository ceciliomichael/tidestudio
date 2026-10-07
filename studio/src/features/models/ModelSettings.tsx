import { SectionHeader } from "../../components/ui/SectionHeader";
import { Switch } from "../../components/ui/Switch";
import { TextField } from "../../components/ui/TextField";
import type { ModelInfo, ServerConfig } from "../../lib/tauri";

type Props = {
  selectedModel: ModelInfo | null;
  config: ServerConfig | null;
  onChange: (config: ServerConfig) => void;
};

export function ModelSettings({
  selectedModel,
  config,
  onChange,
}: Props) {
  function update(patch: Partial<ServerConfig>) {
    if (!config) {
      return;
    }

    onChange({
      ...config,
      ...patch,
    });
  }

  return (
    <section className="settings-section">
      <div>
        <SectionHeader
          eyebrow="Model configuration"
          title={selectedModel?.name ?? "No model selected"}
          description={
            selectedModel
              ? "Configure how this model will be launched from the Server page."
              : "Select a model from the library to configure it."
          }
          compact
        />

        {selectedModel ? (
          <p className="path-line" title={selectedModel.path}>
            {selectedModel.path}
          </p>
        ) : null}
      </div>

      {config ? (
        <>
          <div className="inspector-fields">
            <TextField
              id="model-port"
              label="Port"
              value={config.port}
              min={1}
              max={65535}
              type="number"
              onChange={(event) => update({ port: Number(event.target.value) })}
            />

            <TextField
              id="model-context-size"
              label="Context size"
              value={config.contextSize ?? ""}
              min={1}
              type="number"
              onChange={(event) =>
                update({
                  contextSize: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />

            <TextField
              id="model-gpu-layers"
              label="GPU layers"
              value={config.gpuLayers ?? ""}
              type="number"
              onChange={(event) =>
                update({
                  gpuLayers: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />

            <TextField
              id="model-temperature"
              label="Temperature"
              value={config.temperature ?? ""}
              min={0}
              max={2}
              step={0.05}
              type="number"
              onChange={(event) =>
                update({
                  temperature: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </div>

          <div className="inspector-setting-row">
            <div>
              <strong>Flash attention</strong>
              <span>Use flash attention when the runtime supports it.</span>
            </div>
            <Switch
              className="tide-switch"
              checked={config.flashAttention}
              label="Flash attention"
              onChange={(flashAttention) => update({ flashAttention })}
            />
          </div>

          <div className="advanced-field">
            <TextField
              id="model-extra-arguments"
              label="Extra arguments"
              value={config.extraArgs.join(" ")}
              type="text"
              placeholder="--threads 12"
              hint="Passed directly to llama-server."
              onChange={(event) =>
                update({
                  extraArgs: event.target.value.trim()
                    ? event.target.value.trim().split(/\s+/)
                    : [],
                })
              }
            />
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          Select a model to edit its launch configuration.
        </div>
      )}
    </section>
  );
}
