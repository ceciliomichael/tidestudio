import { Info } from "lucide-react";
import { CollapsibleSection } from "../../components/ui/CollapsibleSection";
import type { CatalogModel } from "./types";

type Props = {
  model: CatalogModel;
};

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function ModelInfoTab({ model }: Props) {
  const rows = [
    ["Model", `${model.publisher}/${model.name}`],
    ["File", fileName(model.path)],
    ["Format", "GGUF"],
    ["Quantization", model.quantization],
    ["Architecture", model.architecture],
    ["Type", model.category],
    ["Publisher", model.publisher],
    ["Parameters", model.parameters],
    ["Size on disk", model.size],
  ];

  return (
    <div className="model-inspector-tab">
      <CollapsibleSection title="Model Information" icon={Info}>
        <div className="model-info-grid">
          {rows.map(([label, value]) => (
            <div className="model-info-row" key={label}>
              <span>{label}</span>
              <strong title={value}>{value}</strong>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
