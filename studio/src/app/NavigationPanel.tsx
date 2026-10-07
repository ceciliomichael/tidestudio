import {
  Download,
  LibraryBig,
  Server,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

export type ActivePage = "server" | "models";

type Props = {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
};

const items = [
  {
    id: "server" as const,
    label: "Server",
    icon: Server,
    available: true,
  },
  {
    id: "models" as const,
    label: "Models",
    icon: LibraryBig,
    available: true,
  },
  {
    id: null,
    label: "Downloads",
    icon: Download,
    available: false,
  },
  {
    id: null,
    label: "Presets",
    icon: SlidersHorizontal,
    available: false,
  },
  {
    id: null,
    label: "Settings",
    icon: Settings,
    available: false,
  },
];

export function NavigationPanel({ activePage, onPageChange }: Props) {
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
                disabled={!item.available}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (item.id) {
                    onPageChange(item.id);
                  }
                }}
              >
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                <span className="navigation-item__label">{item.label}</span>
                {!item.available ? (
                  <span className="navigation-item__meta">Soon</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
