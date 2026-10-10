import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { ModelsDirectoryInfo } from "../../lib/tauri";

type Props = {
  directory: ModelsDirectoryInfo | null;
  busy: boolean;
  onDirectoryChange: (path: string) => Promise<void>;
  onReset: () => Promise<void>;
};

export function ConfigurationSettings({
  directory,
  busy,
  onDirectoryChange,
  onReset,
}: Props) {
  async function browse() {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: directory?.path,
      title: "Choose TideStudio models directory",
    });
    if (typeof selected === "string" && selected.trim()) {
      await onDirectoryChange(selected);
    }
  }

  return (
    <div className="settings-content">
      <section className="settings-section">
        <h2>Storage</h2>
        <div className="settings-section__group">
          <div className="settings-storage-card">
            <div className="settings-storage-card__copy">
              <strong>Models directory</strong>
              <p>Where TideStudio stores and discovers models.</p>
            </div>

            <div className="settings-storage-editor">
              <div className="settings-storage-path" title={directory?.path}>
                {directory?.path ?? "Loading..."}
              </div>
              <Button
                className="settings-storage-browse"
                size="compact"
                disabled={busy}
                onClick={() => void browse()}
              >
                <FolderOpen size={15} aria-hidden="true" />
                Browse
              </Button>
            </div>

            {directory && !directory.isDefault ? (
              <button
                className="settings-storage-reset"
                type="button"
                disabled={busy}
                onClick={() => void onReset()}
              >
                Use default
                <span>{directory.defaultPath}</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
