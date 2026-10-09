import {
  ChevronRight,
  Download,
  Heart,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { InputField } from "../../components/ui/InputField";
import { Dropdown } from "../../components/ui/Dropdown";
import type {
  HuggingFaceModelSummary,
  ModelSearchSource,
} from "./types";

type Props = {
  models: HuggingFaceModelSummary[];
  source: ModelSearchSource;
  selectedRepoId: string | null;
  searching: boolean;
  onSearch: (query: string) => void;
  onSourceChange: (source: ModelSearchSource, query: string) => void;
  onSelect: (model: HuggingFaceModelSummary) => void;
};

const SOURCE_OPTIONS = [
  { value: "huggingface", label: "Hugging Face" },
  { value: "modelscope", label: "ModelScope" },
] satisfies Array<{ value: ModelSearchSource; label: string }>;

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function repoName(repoId: string) {
  return repoId.split("/").pop() || repoId;
}

function publisherName(model: HuggingFaceModelSummary) {
  return model.author || model.repoId.split("/")[0] || "Unknown";
}

function publisherInitial(model: HuggingFaceModelSummary) {
  return publisherName(model).trim().charAt(0).toUpperCase() || "H";
}

function modelBadges(model: HuggingFaceModelSummary) {
  const seen = new Set(["gguf", model.visionCapable ? "vision" : "text"]);
  const ignored = new Set([
    "transformers",
    "safetensors",
    "endpoints_compatible",
  ]);

  return [model.pipelineTag, ...model.tags]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (
        seen.has(normalized) ||
        ignored.has(normalized) ||
        normalized.includes(":") ||
        value.length > 24
      ) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .slice(0, 3);
}

export function DownloadsBrowser({
  models,
  source,
  selectedRepoId,
  searching,
  onSearch,
  onSourceChange,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const onSearchRef = useRef(onSearch);
  const mountedRef = useRef(false);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      onSearchRef.current(query.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  const showSearchState =
    searching && (query.trim().length > 0 || models.length === 0);

  return (
    <section className="downloads-browser">
      <div className="model-search-toolbar">
        <div className="page-heading">
          <div>
            <h1>Model Search</h1>
            <p>Discover and download llama.cpp-compatible GGUF models.</p>
          </div>
          <span>{models.length} models</span>
        </div>
        <div className="model-search-controls">
          <div className="model-search-field">
            <Search
              className="model-search-field__icon"
              size={16}
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <InputField
              label="Search models"
              type="search"
              value={query}
              placeholder="Search models by name or author..."
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                className="model-search-field__clear"
                type="button"
                aria-label="Clear model search"
                onClick={() => setQuery("")}
              >
                <X size={14} strokeWidth={1.9} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="model-search-source">
            <Dropdown
              ariaLabel="Model source"
              value={source}
              options={SOURCE_OPTIONS}
              onChange={(nextSource) => {
                onSourceChange(nextSource, query.trim());
              }}
            />
          </div>
        </div>
      </div>

      <div className="downloads-results">
        {showSearchState ? (
          <div className="downloads-search-state" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                className="downloads-result downloads-result--skeleton"
                key={index}
              >
                <span className="downloads-result__avatar downloads-skeleton__avatar" />

                <div className="downloads-result__copy">
                  <div className="downloads-result__identity">
                    <span className="downloads-skeleton__name" />
                    <span className="downloads-skeleton__publisher" />
                  </div>

                  <div className="downloads-result__meta">
                    <span className="downloads-skeleton__badge downloads-skeleton__badge--format" />
                    <span className="downloads-skeleton__badge downloads-skeleton__badge--vision" />
                  </div>
                </div>

                <div className="downloads-result__metrics">
                  <span>
                    <span className="downloads-skeleton__metric-icon" />
                    <span className="downloads-skeleton__metric-value" />
                  </span>
                  <span>
                    <span className="downloads-skeleton__metric-icon" />
                    <span className="downloads-skeleton__metric-value downloads-skeleton__metric-value--short" />
                  </span>
                </div>

                <span className="downloads-skeleton__chevron" />
              </div>
            ))}
          </div>
        ) : models.length === 0 && !searching ? (
          <div className="downloads-empty">
            No matching public GGUF repositories found.
          </div>
        ) : null}

        {!showSearchState ? models.map((model) => {
          const badges = modelBadges(model);
          return (
            <button
              className={
                model.repoId === selectedRepoId
                  ? "downloads-result is-selected"
                  : "downloads-result"
              }
              type="button"
              key={model.repoId}
              onClick={() => onSelect(model)}
            >
              <div className="downloads-result__avatar" aria-hidden="true">
                {publisherInitial(model)}
              </div>

              <div className="downloads-result__copy">
                <div className="downloads-result__identity">
                  <strong>{repoName(model.repoId)}</strong>
                  <span>{publisherName(model)}</span>
                </div>

                <div className="downloads-result__meta">
                  <span className="downloads-result__format">GGUF</span>
                  <span
                    className={
                      model.visionCapable
                        ? "downloads-result__vision is-capable"
                        : "downloads-result__vision"
                    }
                  >
                    {model.visionCapable ? "Vision" : "Text"}
                  </span>
                  {badges.map((badge) => (
                    <span className="downloads-result__tag" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className="downloads-result__metrics">
                <span title="Downloads">
                  <Download size={12} strokeWidth={1.8} aria-hidden="true" />
                  {compactNumber(model.downloads)}
                </span>
                <span title="Likes">
                  <Heart size={12} strokeWidth={1.8} aria-hidden="true" />
                  {compactNumber(model.likes)}
                </span>
              </div>

              <ChevronRight
                className="downloads-result__chevron"
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          );
        }) : null}
      </div>
    </section>
  );
}
