import {
  Bot,
  Eye,
  Hammer,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { Switch } from "../../components/ui/Switch";
import type { ModelConfig } from "../../lib/config";
import type { CatalogModel } from "../models/types";

type Props = {
  open: boolean;
  allModels: CatalogModel[];
  loadedModels: CatalogModel[];
  configs: Record<string, ModelConfig>;
  onClose: () => void;
  onLoad: (model: CatalogModel) => void;
  onEject: (modelId: string) => void;
};

export function LoadModelDialog({
  open,
  allModels,
  loadedModels,
  configs,
  onClose,
  onLoad,
  onEject,
}: Props) {
  const [query, setQuery] = useState("");
  const [manualParameters, setManualParameters] = useState(false);

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return allModels;
    }

    return allModels.filter((model) =>
      [
        model.name,
        model.publisher,
        model.architecture,
        model.parameters,
        model.quantization,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [allModels, query]);

  const loadedIds = new Set(loadedModels.map((model) => model.id));

  return (
    <Modal
      title="Load Model"
      open={open}
      onClose={onClose}
      className="load-model-dialog"
    >
      <div className="load-model-dialog__search">
        <InputField
          label="Filter Models"
          type="text"
          value={query}
          placeholder="Type to filter models..."
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="load-model-dialog__body">
        <section className="load-model-dialog__section">
          <div className="load-model-dialog__section-heading">
            <h3>Currently Loaded</h3>
            <span>{loadedModels.length}</span>
          </div>

          <div className="load-model-dialog__loaded-list">
            {loadedModels.map((model) => {
              const config = configs[model.path];

              return (
                <div className="load-model-dialog__loaded-row" key={model.id}>
                  <div className="load-model-dialog__loaded-copy">
                    <strong>{model.name}</strong>
                    <div className="load-model-dialog__tags">
                      <span>Context: {config?.contextSize ?? "Default"}</span>
                      <span>{model.quantization}</span>
                      <span>{model.category}</span>
                      {model.supportsReasoning ? (
                        <span className="is-accent">Thinking</span>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => onEject(model.id)}
                  >
                    <Upload size={12} strokeWidth={1.9} aria-hidden="true" />
                    Eject
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="load-model-dialog__section">
          <div className="load-model-dialog__section-heading">
            <h3>Your Models</h3>
            <span>{filteredModels.length}</span>
          </div>

          <div className="load-model-dialog__catalog">
            {filteredModels.map((model) => {
              const loaded = loadedIds.has(model.id);

              return (
                <div className="load-model-dialog__catalog-row" key={model.id}>
                  <div className="load-model-dialog__catalog-name">
                    <Bot size={15} strokeWidth={1.9} aria-hidden="true" />
                    <div>
                      <strong>{model.name}</strong>
                      <span>{model.publisher}</span>
                    </div>
                  </div>

                  <span>{model.parameters}</span>
                  <span>{model.architecture}</span>
                  <span>{model.quantization}</span>
                  <span>{model.size}</span>

                  <div className="load-model-dialog__catalog-actions">
                    {model.supportsReasoning ? (
                      <Eye size={14} strokeWidth={1.9} aria-hidden="true" />
                    ) : null}
                    {model.category === "Drafter" ? (
                      <Hammer size={14} strokeWidth={1.9} aria-hidden="true" />
                    ) : null}
                    <Button
                      variant={loaded ? "secondary" : "primary"}
                      size="compact"
                      disabled={loaded}
                      onClick={() => onLoad(model)}
                    >
                      {loaded ? "Loaded" : "Load"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="load-model-dialog__footer">
        <div className="load-model-dialog__manual">
          <Switch
            className="tide-switch"
            checked={manualParameters}
            label="Manually choose model load parameters"
            onChange={setManualParameters}
          />
          <span>Manually choose model load parameters</span>
        </div>
      </footer>
    </Modal>
  );
}
