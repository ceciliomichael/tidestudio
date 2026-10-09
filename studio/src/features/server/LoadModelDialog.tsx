import { ChevronRight, Search, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
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
  pendingModelPaths: string[];
  onClose: () => void;
  onLoad: (model: CatalogModel) => void;
  onStop: (modelId: string) => void;
};

export function LoadModelDialog({
  open,
  allModels,
  loadedModels,
  pendingModelPaths,
  onClose,
  onLoad,
  onStop,
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
  const loadedById = new Map(loadedModels.map((model) => [model.id, model]));

  return (
    <Modal
      title="Load Model"
      open={open}
      onClose={onClose}
      className="load-model-dialog"
      overlayClassName="load-model-dialog-overlay"
    >
      <div className="load-model-dialog__search">
        <Search size={14} strokeWidth={1.8} aria-hidden="true" />
        <input
          type="text"
          value={query}
          placeholder="Type to filter models..."
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            className="load-model-dialog__search-clear"
            type="button"
            aria-label="Clear model filter"
            onClick={() => setQuery("")}
          >
            <X size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="load-model-dialog__body">
        <section className="load-model-dialog__section">
          <div className="load-model-dialog__section-heading">
            <div>
              <h3>Your Models</h3>
              <span>{filteredModels.length}</span>
            </div>
            <SegmentedField
              ariaLabel="Sort models"
              className="load-model-dialog__sort"
              options={SORT_OPTIONS}
              value={sortMode}
              onChange={setSortMode}
            />
          </div>

          <div className="load-model-dialog__catalog">
            {filteredModels.map((model) => {
              const loaded = loadedIds.has(model.id);
              const loading = pendingModelPaths.includes(model.path);
              const loadedModel = loadedById.get(model.id);

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
                    <div>
                      <strong title={model.name}>{model.name}</strong>
                      <span className="load-model-dialog__inline-meta">
                        <span>{model.quantization}</span>
                        {model.supportsMtp ? <span>MTP</span> : null}
                        <span>{model.publisher}</span>
                      </span>
                    </div>
                  </div>

                  <span>{model.parameters}</span>
                  <span>{model.architecture}</span>
                  <span className="load-model-dialog__catalog-type">{model.category}</span>
                  <span>{model.size}</span>

                  <div className="load-model-dialog__catalog-actions">
                    {loaded ? (
                      <Button
                        variant="danger"
                        size="compact"
                        disabled={loading}
                        onClick={() => onStop(loadedModel?.id ?? model.id)}
                      >
                        {loading ? null : (
                          <Square size={10} strokeWidth={2} aria-hidden="true" />
                        )}
                        {loading ? "Loading" : "Stop"}
                      </Button>
                    ) : (
                      <ChevronRight
                        className="load-model-dialog__row-chevron"
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}
