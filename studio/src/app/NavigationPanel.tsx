import {
  Download,
  LibraryBig,
  Search,
  Server,
  Settings,
} from "lucide-react";

export type ActivePage = "server" | "models" | "modelSearch" | "downloads" | "settings";

type Props = {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  activeDownloadCount: number;
};

const items = [
  {
    id: "server" as const,
    label: "Server",
    icon: Server,
  },
  {
    id: "models" as const,
    label: "Models",
    icon: LibraryBig,
  },
  {
    id: "modelSearch" as const,
    label: "Model Search",
    icon: Search,
  },
  {
    id: "downloads" as const,
    label: "Downloads",
    icon: Download,
  },
];

export function NavigationPanel({ activePage, onPageChange, activeDownloadCount }: Props) {
  return (
    <nav className="navigation-panel" aria-label="TideStudio navigation">
      <div className="navigation-section">
        <p className="navigation-label">Workspace</p>

        <div className="navigation-list">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activePage;

            return (
              <button
                className={isActive ? "navigation-item is-active" : "navigation-item"}
                type="button"
                key={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onPageChange(item.id)}
              >
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                <span className="navigation-item__label">{item.label}</span>
                {item.id === "downloads" && activeDownloadCount > 0 ? (
                  <span className="navigation-download-badge">{activeDownloadCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="navigation-spacer" />
      <button
        className="navigation-item navigation-settings-button"
        type="button"
        onClick={() => onPageChange("settings")}
      >
        <Settings size={17} strokeWidth={2} aria-hidden="true" />
        <span className="navigation-item__label">Settings</span>
      </button>
    </nav>
  );
}
