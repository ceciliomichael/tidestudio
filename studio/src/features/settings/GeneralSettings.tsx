import { Dropdown } from "../../components/ui/Dropdown";
import { SegmentedField } from "../../components/ui/SegmentedField";
import type { AppAppearance, AppLanguage } from "../../lib/appearance";

const appearanceOptions: { label: string; value: AppAppearance }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const languageOptions: { label: string; value: AppLanguage }[] = [
  { label: "English (United States)", value: "en-US" },
  { label: "English (United Kingdom)", value: "en-GB" },
  { label: "Filipino (Philippines)", value: "fil-PH" },
];

type Props = {
  appearance: AppAppearance;
  language: AppLanguage;
  onAppearanceChange: (value: AppAppearance) => void;
  onLanguageChange: (value: AppLanguage) => void;
};

export function GeneralSettings({
  appearance,
  language,
  onAppearanceChange,
  onLanguageChange,
}: Props) {
  return (
    <div className="settings-content">
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-section__group">
          <div className="settings-row">
            <div className="settings-row__text">
              <strong>Theme</strong>
              <p>Choose the app theme or follow your system appearance automatically.</p>
            </div>
            <div className="settings-row__control settings-row__control--theme">
              <SegmentedField
                ariaLabel="App appearance"
                value={appearance}
                options={appearanceOptions}
                onChange={onAppearanceChange}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>Preferences</h2>
        <div className="settings-section__group">
          <div className="settings-row">
            <div className="settings-row__text">
              <strong>Language</strong>
              <p>Set the locale used for date and time formatting across the app.</p>
            </div>
            <div className="settings-row__control settings-row__control--language">
              <Dropdown
                ariaLabel="App language"
                value={language}
                options={languageOptions}
                onChange={onLanguageChange}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
