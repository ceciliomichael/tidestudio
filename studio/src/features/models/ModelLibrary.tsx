import type { CatalogModel } from "./types";

type Props = {
  models: CatalogModel[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function ModelLibrary({
  models,
  selectedId,
  onSelect,
}: Props) {
  return (
    <section className="model-catalog">
      <div className="model-catalog__table">
        <div className="model-catalog__header">
          <span>Model</span>
          <span>Type</span>
          <span>Params</span>
          <span>Quant</span>
          <span>Size</span>
          <span>Modified</span>
        </div>

        <div className="model-catalog__body">
          {models.length === 0 ? (
            <div className="model-catalog__empty">
              No GGUF models found in TideStudio's models directory.
            </div>
          ) : null}

          {models.map((model) => (
            <button
              className={
                model.id === selectedId
                  ? "model-catalog-row is-selected"
                  : "model-catalog-row"
              }
              key={model.id}
              type="button"
              onClick={() => onSelect(model.id)}
            >
              <span className="model-catalog-row__model">
                <strong>{model.name}</strong>
                <small>{model.publisher}</small>
              </span>
              <span>
                <span className="model-tag">{model.category}</span>
              </span>
              <span>{model.parameters}</span>
              <span>{model.quantization}</span>
              <span>{model.size}</span>
              <span>{model.modified}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
