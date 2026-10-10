import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

export function UpdatesSettings() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings-content">
      <h1>Updates</h1>
      <section className="settings-section">
        <h2>Application</h2>
        <div className="settings-section__group">
          <div className="settings-row">
            <div className="settings-row__text">
              <strong>TideStudio</strong>
              <p>{version ? `Version ${version}` : "Version information unavailable."}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
