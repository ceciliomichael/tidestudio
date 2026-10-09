import {
  Activity,
  Bot,
  Download,
  Info,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  SegmentedField,
  type SegmentedFieldOption,
} from "../../components/ui/SegmentedField";
import type { ModelConfig } from "../../lib/config";
import { ModelInfoTab } from "./ModelInfoTab";
import { ModelInferenceTab } from "./ModelInferenceTab";
import { ModelLoadTab } from "./ModelLoadTab";
import type { CatalogModel } from "./types";

type InspectorTab = "info" | "load" | "inference";

type Props = {
  selectedModel: CatalogModel | null;
  config: ModelConfig | null;
  runtimeLoaded?: boolean;
  onChange: (config: ModelConfig) => void;
};

const TABS: readonly SegmentedFieldOption<InspectorTab>[] = [
  {
    label: "Info",
    value: "info",
    icon: Info,
  },
  {
    label: "Load",
    value: "load",
    icon: Download,
  },
  {
    label: "Inference",
    value: "inference",
    icon: Activity,
  },
];

export function ModelInspector({
  selectedModel,
  config,
  runtimeLoaded = false,
  onChange,
}: Props) {
  const [tab, setTab] = useState<InspectorTab>("info");

  useEffect(() => {
    setTab("info");
  }, [selectedModel?.id]);

  if (!selectedModel || !config) {
    return (
      <section className="model-inspector">
        <div className="model-inspector__empty">
          Select a model to inspect and configure it.
        </div>
      </section>
    );
  }

  return (
    <section className="model-inspector">
      <header className="model-inspector__header">
        <div className="model-inspector__title">
          <Bot size={16} strokeWidth={1.9} aria-hidden="true" />
          <strong title={selectedModel.name}>{selectedModel.name}</strong>
        </div>

        <SegmentedField
          ariaLabel="Model inspector"
          className="model-inspector__tabs"
          options={TABS}
          value={tab}
          onChange={setTab}
        />
      </header>

      <div className="model-inspector__content">
        {tab === "info" ? <ModelInfoTab model={selectedModel} /> : null}
        {tab === "load" ? (
          <ModelLoadTab
            config={config}
            runtimeLoaded={runtimeLoaded}
            onChange={onChange}
          />
        ) : null}
        {tab === "inference" ? (
          <ModelInferenceTab
            model={selectedModel}
            config={config}
            runtimeLoaded={runtimeLoaded}
            onChange={onChange}
          />
        ) : null}
      </div>
    </section>
  );
}
