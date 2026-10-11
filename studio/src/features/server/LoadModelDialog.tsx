import { ArrowLeft, Eye, Hammer, Search, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Modal } from "../../components/ui/Modal";
import { SegmentedField } from "../../components/ui/SegmentedField";
import { createDefaultModelConfig, type ModelConfig } from "../../lib/config";
import type { ServerStatus } from "../../lib/tauri";
import type { CatalogModel } from "../models/types";
import { LoadModelSettingsPage } from "./LoadModelSettingsPage";

type SortMode = "recent" | "size" | "name";

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Size", value: "size" },
  { label: "Name", value: "name" },
] as const;

function sizeValue(value: string) {
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const scale = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  }[unit] ?? 0;
  return amount * scale;
}

type Props = {
  open: boolean;
  allModels: CatalogModel[];
  loadedModels: CatalogModel[];
  servers: ServerStatus[];
  configs: Record<string, ModelConfig>;
  onClose: () => void;
  onStop: (port: number) => Promise<void>;
  onLoad: (model: CatalogModel, config: ModelConfig) => void;
};

export function LoadModelDialog({
  open,
  allModels,
  loadedModels,
  servers,
  configs,
  onClose,
  onStop,
  onLoad,
}: Props) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [selectedModel, setSelectedModel] = useState<CatalogModel | null>(null);
  const [draft, setDraft] = useState<ModelConfig | null>(null);
  const [stoppingPorts, setStoppingPorts] = useState<number[]>([]);

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = !normalized
      ? [...allModels]
      : allModels.filter((model) =>
          [
            model.name,
            model.publisher,
            model.architecture,
            model.parameters,
            model.quantization,
          ].some((value) => value.toLowerCase().includes(normalized)),
        );

    if (sortMode === "size") {
      filtered.sort((left, right) => sizeValue(right.size) - sizeValue(left.size));
    } else if (sortMode === "name") {
      filtered.sort((left, right) => left.name.localeCompare(right.name));
    }

    return filtered;
  }, [allModels, query, sortMode]);

  const loadedIds = new Set(loadedModels.map((model) => model.id));

  function closeDialog() {
    setSelectedModel(null);
    setDraft(null);
    onClose();
  }

  function selectModel(model: CatalogModel) {
    if (loadedIds.has(model.id)) return;

    const saved = configs[model.path];
    setSelectedModel(model);
    setDraft(
      saved
        ? {
            ...saved,
            speculativeMode: saved.speculativeMode === "mtp" && !model.supportsMtp
              ? "none"
              : saved.speculativeMode,
          }
        : {
            ...createDefaultModelConfig(),
            chatTemplate: model.chatTemplate ?? "",
            speculativeMode: model.category === "LLM" && model.supportsMtp ? "mtp" : "none",
          },
    );
  }

  function confirmLoad() {
    if (!selectedModel || !draft || loadedIds.has(selectedModel.id)) return;

    const model = selectedModel;
    const config = draft;
    closeDialog();
    onLoad(model, config);
  }

  async function stopModel(port: number) {
    if (stoppingPorts.includes(port)) return;

    setStoppingPorts((current) => [...current, port]);
    try {
      await onStop(port);
    } finally {
      setStoppingPorts((current) => current.filter((value) => value !== port));
    }
  }

  return (
    <Modal
      title="Load Model"
      open={open}
      onClose={closeDialog}
      className={[
        "load-model-dialog",
        selectedModel ? "load-model-dialog--settings" : "",
      ].filter(Boolean).join(" ")}
      overlayClassName="load-model-dialog-overlay"
      hideCloseButton
      headerContent={
        selectedModel ? (
          <div className="load-model-settings__header">
            <IconButton
              className="load-model-settings__back"
              icon={ArrowLeft}
              label="Back to model list"
              size={18}
              autoFocus
              onClick={() => {
                setSelectedModel(null);
                setDraft(null);
              }}
            />
            <strong title={selectedModel.name}>{selectedModel.name}</strong>
          </div>
        ) : (
          <div className="load-model-dialog__search">
            <Search size={14} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="text"
              aria-label="Filter models"
              value={query}
              placeholder="Type to filter models..."
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
            <IconButton
              className="ui-modal__close"
              icon={X}
              label={query ? "Clear model filter" : "Close"}
              size={16}
              onClick={() => {
                if (query) {
                  setQuery("");
                } else {
                  closeDialog();
                }
              }}
            />
          </div>
        )
      }
    >
      {selectedModel && draft ? (
        <LoadModelSettingsPage
          model={selectedModel}
          availableModels={allModels}
          config={draft}
          onChange={setDraft}
          onCancel={closeDialog}
          onLoad={confirmLoad}
        />
      ) : (
        <div className="load-model-dialog__body">
          <section className="load-model-dialog__section">
            <div className="load-model-dialog__section-heading">
              <h3>Your Models</h3>
              <SegmentedField
                ariaLabel="Sort models"
                className="load-model-dialog__sort"
                options={SORT_OPTIONS}
                value={sortMode}
                onChange={setSortMode}
              />
            </div>

            <div className="load-model-dialog__catalog">
              <div className="load-model-dialog__catalog-header" role="row">
                <span>Model</span>
                <span>Publisher</span>
                <span>Params</span>
                <span>Architecture</span>
                <span>Type</span>
                <span>Size</span>
                <span aria-label="Actions" />
              </div>
              {filteredModels.map((model) => {
                const loaded = loadedIds.has(model.id);
                const server = servers.find(
                  (candidate) => candidate.running && candidate.modelPath === model.path,
                );

                return (
                  <div
                    className={
                      loaded
                        ? "load-model-dialog__catalog-row is-loaded"
                        : "load-model-dialog__catalog-row is-loadable"
                    }
                    key={model.id}
                    role={loaded ? undefined : "button"}
                    tabIndex={loaded ? undefined : 0}
                    onClick={loaded ? undefined : () => selectModel(model)}
                    onKeyDown={
                      loaded
                        ? undefined
                        : (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectModel(model);
                            }
                          }
                    }
                  >
                    <div className="load-model-dialog__catalog-name">
                      <strong title={model.name}>{model.name}</strong>
                      <div className="load-model-dialog__capabilities">
                        {model.quantization && model.quantization !== "Unknown" ? (
                          <span
                            className="load-model-dialog__capability"
                            title={`Quantization: ${model.quantization}`}
                          >
                            {model.quantization}
                          </span>
                        ) : null}
                        {model.supportsMtp ? (
                          <span
                            className="load-model-dialog__capability"
                            title="Multi-token prediction (MTP)"
                          >
                            MTP
                          </span>
                        ) : null}
                        {model.supportsVision ? (
                          <span
                            className="load-model-dialog__capability load-model-dialog__capability--vision"
                            title="Vision capable"
                            aria-label="Vision capable"
                          >
                            <Eye size={13} strokeWidth={1.9} aria-hidden="true" />
                          </span>
                        ) : null}
                        {model.supportsTools ? (
                          <span
                            className="load-model-dialog__capability load-model-dialog__capability--tools"
                            title="Tool-use indicators detected in the chat template or metadata; training and runtime compatibility are not verified"
                            aria-label="Tool-use indicators detected; not verified"
                          >
                            <Hammer size={13} strokeWidth={1.9} aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="load-model-dialog__catalog-publisher" title={model.publisher}>
                      {model.publisher}
                    </span>
                    <span>{model.parameters}</span>
                    <span>{model.architecture}</span>
                    <span className="load-model-dialog__catalog-type">{model.category}</span>
                    <span>{model.size}</span>
                    <span className="load-model-dialog__catalog-action">
                      {loaded ? (
                        <Button
                          variant="danger"
                          size="compact"
                          className="load-model-dialog__stop"
                          disabled={!server || stoppingPorts.includes(server.port)}
                          title={server ? "Stop model" : "Waiting for the model process to start"}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (server) void stopModel(server.port);
                          }}
                        >
                          <Square size={12} strokeWidth={2} aria-hidden="true" />
                          Stop
                        </Button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
