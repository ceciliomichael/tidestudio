import {
  Braces,
  ChevronDown,
  MessagesSquare,
  ServerCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  SegmentedField,
  type SegmentedFieldOption,
} from "../../components/ui/SegmentedField";
import {
  getUiPreference,
  setUiPreference,
} from "../../lib/tauri";

type EndpointFamily = "openai" | "anthropic" | "native";

type Endpoint = {
  method: "GET" | "POST";
  path: string;
  note?: string;
};

const COLLAPSED_PREFERENCE_KEY = "server.supported_endpoints.collapsed";

const FAMILY_OPTIONS: readonly SegmentedFieldOption<EndpointFamily>[] = [
  {
    label: "OpenAI-compatible",
    value: "openai",
    icon: Braces,
  },
  {
    label: "Anthropic-compatible",
    value: "anthropic",
    icon: MessagesSquare,
  },
  {
    label: "llama.cpp",
    value: "native",
    icon: ServerCog,
  },
];

const ENDPOINTS: Record<EndpointFamily, Endpoint[]> = {
  openai: [
    { method: "GET", path: "/v1/models" },
    { method: "POST", path: "/v1/responses" },
    { method: "POST", path: "/v1/chat/completions" },
    { method: "POST", path: "/v1/completions" },
    { method: "POST", path: "/v1/embeddings" },
  ],
  anthropic: [
    { method: "POST", path: "/v1/messages" },
  ],
  native: [
    { method: "GET", path: "/health", note: "Public health check" },
    { method: "POST", path: "/completion" },
    { method: "POST", path: "/embeddings" },
    { method: "POST", path: "/tokenize" },
    { method: "GET", path: "/slots", note: "Enabled by default" },
    { method: "GET", path: "/metrics", note: "Requires --metrics" },
    { method: "GET", path: "/props", note: "Read properties" },
    { method: "POST", path: "/props", note: "Requires --props" },
    { method: "POST", path: "/rerank", note: "Requires reranking mode" },
  ],
};

export function SupportedEndpointsPanel() {
  const [family, setFamily] = useState<EndpointFamily>("openai");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let active = true;

    void getUiPreference(COLLAPSED_PREFERENCE_KEY)
      .then((value) => {
        if (!active || value === null) {
          return;
        }

        setCollapsed(value !== "false");
      })
      .catch(() => {
        // Keep the safe default (collapsed) if persistence is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      void setUiPreference(
        COLLAPSED_PREFERENCE_KEY,
        String(next),
      );
      return next;
    });
  }

  return (
    <section
      className={
        collapsed
          ? "supported-endpoints-panel is-collapsed"
          : "supported-endpoints-panel"
      }
    >
      <button
        className="supported-endpoints-panel__header"
        type="button"
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <span>
          <h3>Supported Endpoints</h3>
          {!collapsed ? <p>Routes exposed by llama.cpp server.</p> : null}
        </span>
        <ChevronDown
          className={
            collapsed
              ? "supported-endpoints-panel__chevron"
              : "supported-endpoints-panel__chevron is-open"
          }
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </button>

      {!collapsed ? (
        <>
          <div className="supported-endpoints-panel__segments">
            <SegmentedField
              ariaLabel="Endpoint family"
              options={FAMILY_OPTIONS}
              value={family}
              onChange={setFamily}
            />
          </div>

          <div className="supported-endpoints-panel__list">
            {ENDPOINTS[family].map((endpoint) => (
              <div
                className="supported-endpoint-row"
                key={`${endpoint.method}-${endpoint.path}`}
              >
                <span
                  className="supported-endpoint-row__method"
                  data-method={endpoint.method}
                >
                  {endpoint.method}
                </span>
                <code>{endpoint.path}</code>
                <span className="supported-endpoint-row__note">
                  {endpoint.note ?? ""}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
