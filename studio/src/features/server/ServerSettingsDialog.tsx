import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import {
  KeyRound,
  Network,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { Switch } from "../../components/ui/Switch";
import type { ServerSettings } from "../../lib/config";

type Props = {
  open: boolean;
  settings: ServerSettings;
  onClose: () => void;
  onChange: (settings: ServerSettings) => void;
};

export function ServerSettingsDialog({
  open,
  settings,
  onClose,
  onChange,
}: Props) {
  const [draft, setDraft] = useState(settings);
  const [portInput, setPortInput] = useState(String(settings.port));
  const [ttlInput, setTtlInput] = useState(String(settings.maxIdleTtlMinutes));

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setPortInput(String(settings.port));
      setTtlInput(String(settings.maxIdleTtlMinutes));
    }
  }, [open, settings]);

  function update(patch: Partial<ServerSettings>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  const activeKeyCount =
    draft.apiKeyEnabled && draft.apiKey.trim() ? 1 : 0;
  const parsedPort = Number(portInput);
  const portValid =
    portInput.trim() !== "" &&
    Number.isInteger(parsedPort) &&
    parsedPort >= 1 &&
    parsedPort <= 65535;
  const parsedTtl = Number(ttlInput);
  const ttlValid =
    ttlInput.trim() !== "" &&
    Number.isInteger(parsedTtl) &&
    parsedTtl >= 1;
  const apiKeyValid = !draft.apiKeyEnabled || draft.apiKey.trim() !== "";
  const canApply = portValid && ttlValid && apiKeyValid;

  return (
    <Modal
      title="Server Settings"
      open={open}
      onClose={onClose}
      className="server-settings-dialog"
      hideHeader
    >
      <div className="server-settings-dialog__body">
        <section className="server-settings-dialog__section">
          <header className="server-settings-dialog__section-header">
            <h3>Connection</h3>
          </header>
          <div className="server-settings-dialog__group">
            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <span className="server-setting-label">
                  <Network size={14} strokeWidth={1.9} aria-hidden="true" />
                  <strong>Server Port</strong>
                </span>
                <small>Public API port</small>
              </div>
              <input
                className="ui-input ui-input--compact server-settings-dialog__number"
                type="number"
                min={1}
                max={65535}
                value={portInput}
                aria-label="Server port"
                onChange={(event) => setPortInput(event.target.value)}
              />
            </div>

            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <strong>Serve on Local Network</strong>
                <small>Listen beyond localhost</small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.serveOnLocalNetwork}
                label="Serve on local network"
                onChange={(serveOnLocalNetwork) =>
                  update({ serveOnLocalNetwork })
                }
              />
            </div>

            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <span className="server-setting-label">
                  <ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />
                  <strong>Enable CORS</strong>
                </span>
                <small>Allow browser-based clients</small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.corsEnabled}
                label="Enable CORS"
                onChange={(corsEnabled) => update({ corsEnabled })}
              />
            </div>
          </div>
        </section>

        <section className="server-settings-dialog__section">
          <header className="server-settings-dialog__section-header">
            <h3>Access</h3>
          </header>
          <div className="server-settings-dialog__group">
            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <span className="server-setting-label">
                  <KeyRound size={14} strokeWidth={1.9} aria-hidden="true" />
                  <strong>Require Authentication</strong>
                </span>
                <small>
                  {activeKeyCount === 1 ? "1 active API key" : "No active API key"}
                </small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.apiKeyEnabled}
                label="Require authentication"
                onChange={(apiKeyEnabled) => update({ apiKeyEnabled })}
              />
            </div>

            {draft.apiKeyEnabled ? (
              <div className="server-settings-dialog__api-key">
                <InputField
                  label="API Key"
                  type="password"
                  value={draft.apiKey}
                  placeholder="Enter API key"
                  autoComplete="off"
                  onChange={(event) => update({ apiKey: event.target.value })}
                />
              </div>
            ) : null}

          </div>
        </section>

        <section className="server-settings-dialog__section">
          <header className="server-settings-dialog__section-header">
            <h3>Runtime</h3>
          </header>
          <div className="server-settings-dialog__group">
            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <strong>Just-in-Time Model Loading</strong>
                <small>Load models when requested</small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.jitModelLoading}
                label="Just-in-Time model loading"
                onChange={(jitModelLoading) => update({ jitModelLoading })}
              />
            </div>

            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <strong>Auto unload unused models</strong>
                <small>Release idle JIT-loaded workers</small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.autoUnloadJitModels}
                label="Auto unload unused JIT loaded models"
                onChange={(autoUnloadJitModels) =>
                  update({ autoUnloadJitModels })
                }
              />
            </div>

            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <span className="server-setting-label">
                  <TimerReset size={14} strokeWidth={1.9} aria-hidden="true" />
                  <strong>Max idle TTL</strong>
                </span>
                <small>Minutes before an idle model unloads</small>
              </div>
              <input
                className="ui-input ui-input--compact server-settings-dialog__number"
                type="number"
                min={1}
                value={ttlInput}
                aria-label="Maximum idle TTL in minutes"
                onChange={(event) => setTtlInput(event.target.value)}
              />
            </div>

            <div className="server-settings-dialog__item">
              <div className="server-settings-dialog__item-copy">
                <strong>Only Keep Last JIT Model</strong>
                <small>Keep one JIT-loaded worker at a time</small>
              </div>
              <Switch
                className="tide-switch"
                checked={draft.onlyKeepLastJitModel}
                label="Only keep last JIT loaded model"
                onChange={(onlyKeepLastJitModel) =>
                  update({ onlyKeepLastJitModel })
                }
              />
            </div>
          </div>
        </section>
      </div>

      <footer className="server-settings-dialog__footer">
        <Button variant="secondary" size="compact" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="compact"
          disabled={!canApply}
          onClick={() => {
            onChange({
              ...draft,
              port: parsedPort,
              maxIdleTtlMinutes: parsedTtl,
            });
            onClose();
          }}
        >
          Apply Settings
        </Button>
      </footer>
    </Modal>
  );
}
