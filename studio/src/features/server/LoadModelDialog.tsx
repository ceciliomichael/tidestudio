import { Eye, Hammer, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "../../components/ui/IconButton";
import { Modal } from "../../components/ui/Modal";
import { SegmentedField } from "../../components/ui/SegmentedField";
import type { CatalogModel } from "../models/types";

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
  loadingModelPaths: string[];
  onClose: () => void;
  onLoad: (model: CatalogModel) => void;
};

export function LoadModelDialog({
  open,
  allModels,
  loadedModels,
  loadingModelPaths,
  onClose,
  onLoad,
}: Props) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

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

  return (
    <Modal
      title="Load Model"
      open={open}
      onClose={onClose}
      className="load-model-dialog"
      overlayClassName="load-model-dialog-overlay"
      hideCloseButton
      headerContent={
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
                onClose();
              }
            }}
          />
        </div>
      }
    >
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
            </div>
            {filteredModels.map((model) => {
              const loaded = loadedIds.has(model.id);
              const loading = loadingModelPaths.includes(model.path);

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
                  onClick={
                    loaded
                      ? undefined
                      : () => {
                          onClose();
                          onLoad(model);
                        }
                  }
                  onKeyDown={
                    loaded
                      ? undefined
                      : (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onClose();
                            onLoad(model);
                          }
                        }
                  }
                >
                  <div className="load-model-dialog__catalog-name">
                    <strong title={model.name}>{model.name}</strong>
                    <div className="load-model-dialog__capabilities">
                      {model.quantization && model.quantization !== "Unknown" ? (
                        <span className="load-model-dialog__capability" title={`Quantization: ${model.quantization}`}>
                          {model.quantization}
                        </span>
                      ) : null}
                      {model.supportsMtp ? (
                        <span className="load-model-dialog__capability" title="Multi-token prediction (MTP)">MTP</span>
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
                      {loaded ? (
                        <span className="load-model-dialog__status">
                          {loading ? "Loading" : "Loaded"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <span className="load-model-dialog__catalog-publisher" title={model.publisher}>{model.publisher}</span>
                  <span>{model.parameters}</span>
                  <span>{model.architecture}</span>
                  <span className="load-model-dialog__catalog-type">{model.category}</span>
                  <span>{model.size}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}
