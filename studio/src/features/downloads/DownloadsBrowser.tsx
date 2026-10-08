import {
  ChevronRight,
  Download,
  Heart,
  Search,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { InputField } from "../../components/ui/InputField";
import type { HuggingFaceModelSummary } from "./types";

type Props = {
  models: HuggingFaceModelSummary[];
  selectedRepoId: string | null;
  searching: boolean;
  onSearch: (query: string) => void;
  onSelect: (model: HuggingFaceModelSummary) => void;
};

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

function visibleTags(model: HuggingFaceModelSummary) {
  return model.tags
    .filter(
      (tag) =>
        !tag.includes(":") &&
        tag.toLowerCase() !== "gguf" &&
        tag.toLowerCase() !== "transformers",
    )
    .slice(0, 1);
}

export function DownloadsBrowser({
  models,
  selectedRepoId,
  searching,
  onSearch,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearchRef.current(query.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section className="downloads-browser">
      <div className="model-search-toolbar">
        <div className="model-search-field">
          <Search
            className="model-search-field__icon"
            size={16}
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <InputField
            label="Search Hugging Face"
            type="search"
            value={query}
            placeholder="Search models by name or author..."
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching ? (
            <span className="model-search-field__state">Searching</span>
          ) : null}
        </div>

        <div className="model-search-results-bar">
          <div>
            <strong>Hugging Face GGUF</strong>
            <span>
              {query.trim()
                ? "Results for " + query.trim()
                : "Popular compatible models"}
            </span>
          </div>
          <div className="model-search-results-bar__meta">
            {searching ? <span>Searching</span> : null}
            <span>{models.length} models</span>
          </div>
        </div>
      </div>

      <div className="downloads-results">
        {models.length === 0 && !searching ? (
          <div className="downloads-empty">
            No matching public GGUF repositories found.
          </div>
        ) : null}

        {models.map((model) => {
          const tags = visibleTags(model);

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
                  {model.pipelineTag ? (
                    <span>{model.pipelineTag}</span>
                  ) : tags[0] ? (
                    <span>{tags[0]}</span>
                  ) : null}
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
        })}
      </div>
    </section>
  );
}
