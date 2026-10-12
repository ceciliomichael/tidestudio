import { ArrowLeft, Settings2 } from "lucide-react";

export type SettingsSectionId = "general" | "configuration" | "runtimes";

type Props = {
  selected: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
  onBack: () => void;
};

const sections: { id: SettingsSectionId; title: string; description: string }[] = [
  { id: "general", title: "General", description: "Theme, language, and preferences." },
  { id: "configuration", title: "Configuration", description: "Storage paths and application configuration." },
  { id: "runtimes", title: "Runtimes", description: "Inference engines and hardware acceleration." },
];

export function SettingsSidebar({ selected, onSelect, onBack }: Props) {
  return (
    <aside className="settings-sidebar">
      <button className="settings-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" /> Back to app
      </button>
      <div className="settings-sidebar__title">
        <Settings2 size={17} aria-hidden="true" />
        <strong>Settings</strong>
      </div>
      <nav className="settings-sidebar__items" aria-label="Settings navigation">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={selected === section.id ? "settings-sidebar__item is-active" : "settings-sidebar__item"}
            aria-current={selected === section.id ? "page" : undefined}
            onClick={() => onSelect(section.id)}
          >
            <strong>{section.title}</strong>
            <span>{section.description}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
