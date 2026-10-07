import { Box, HardDrive, RefreshCw } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { SectionHeader } from "../../components/ui/SectionHeader";
import type { ModelInfo } from "../../lib/tauri";

type Props = {
  models: ModelInfo[];
  selectedPath: string;
  onSelect: (path: string) => void;
  onRefresh: () => void;
};

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;

  return `${value.toFixed(index < 3 ? 0 : 1)} ${units[index]}`;
}

export function ModelLibrary({
  models,
  selectedPath,
  onSelect,
  onRefresh,
}: Props) {
  return (
    <section className="model-library">
      <SectionHeader
        eyebrow="Models"
        title="Local library"
        description="Manage local GGUF models and select one to edit its configuration."
        action={
          <IconButton
            icon={RefreshCw}
            label="Refresh models"
            onClick={onRefresh}
          />
        }
      />

      <div className="model-table">
        <div className="model-table-head">
          <span>Model</span>
          <span>Size</span>
        </div>

        {models.length === 0 ? (
          <div className="empty-state main-empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              <HardDrive size={20} strokeWidth={1.8} />
            </div>
            <div>
              <p>No GGUF models found</p>
              <span>Add models to the workspace models directory.</span>
            </div>
          </div>
        ) : (
          <div className="model-table-body">
            {models.map((model) => (
              <button
                className={
                  model.path === selectedPath
                    ? "model-row is-selected"
                    : "model-row"
                }
                key={model.path}
                type="button"
                onClick={() => onSelect(model.path)}
              >
                <div className="model-row-main">
                  <div className="model-icon" aria-hidden="true">
                    <Box size={15} strokeWidth={1.9} />
                  </div>
                  <div>
                    <strong>{model.name}</strong>
                    <span>{model.path}</span>
                  </div>
                </div>
                <span className="model-size">{formatBytes(model.sizeBytes)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
