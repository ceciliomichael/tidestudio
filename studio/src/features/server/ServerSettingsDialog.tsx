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
  function update(patch: Partial<ServerSettings>) {
    onChange({
      ...settings,
      ...patch,
    });
  }

  const activeKeyCount =
    settings.apiKeyEnabled && settings.apiKey.trim() ? 1 : 0;

  return (
    <Modal
      title="Server Settings"
      open={open}
      onClose={onClose}
      className="server-settings-dialog"
    >
      <div className="server-settings-dialog__body">
        <InputField
          label="Server Port"
          layout="inline"
          compact
          type="number"
          min={1}
          max={65535}
          value={settings.port}
          onChange={(event) =>
            update({ port: Number(event.target.value) })
          }
        />

        <div className="server-settings-dialog__row">
          <span className="server-setting-label">
            <KeyRound size={14} strokeWidth={1.9} aria-hidden="true" />
            <span>Require Authentication</span>
          </span>
          <Switch
            className="tide-switch"
            checked={settings.apiKeyEnabled}
            label="Require authentication"
            onChange={(apiKeyEnabled) => update({ apiKeyEnabled })}
          />
        </div>

        <div className="server-settings-dialog__row">
          <span>Active API Keys</span>
          <strong>{activeKeyCount}</strong>
        </div>

        {settings.apiKeyEnabled ? (
          <InputField
            label="API Key"
            type="password"
            value={settings.apiKey}
            placeholder="Enter API key"
            autoComplete="off"
            onChange={(event) => update({ apiKey: event.target.value })}
          />
        ) : null}

        <div className="server-settings-dialog__row">
          <span className="server-setting-label">
            <Network size={14} strokeWidth={1.9} aria-hidden="true" />
            <span>Serve on Local Network</span>
          </span>
          <Switch
            className="tide-switch"
            checked={settings.serveOnLocalNetwork}
            label="Serve on local network"
            onChange={(serveOnLocalNetwork) =>
              update({ serveOnLocalNetwork })
            }
          />
        </div>

        <div className="server-settings-dialog__row">
          <span>Allow per-request MCPs</span>
          <Switch
            className="tide-switch"
            checked={settings.allowPerRequestMcps}
            label="Allow per-request MCPs"
            onChange={(allowPerRequestMcps) =>
              update({ allowPerRequestMcps })
            }
          />
        </div>

        <div className="server-settings-dialog__row is-disabled">
          <span>Allow calling servers from mcp.json</span>
          <Switch
            className="tide-switch"
            checked={settings.allowMcpJsonServers}
            disabled
            label="Allow calling servers from mcp.json"
            onChange={() => undefined}
          />
        </div>

        <div className="server-settings-dialog__row">
          <span className="server-setting-label">
            <ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />
            <span>Enable CORS</span>
          </span>
          <Switch
            className="tide-switch"
            checked={settings.corsEnabled}
            label="Enable CORS"
            onChange={(corsEnabled) => update({ corsEnabled })}
          />
        </div>

        <div className="server-settings-dialog__row">
          <span>Just-in-Time Model Loading</span>
          <Switch
            className="tide-switch"
            checked={settings.jitModelLoading}
            label="Just-in-Time model loading"
            onChange={(jitModelLoading) => update({ jitModelLoading })}
          />
        </div>

        <div className="server-settings-dialog__row">
          <span>Auto unload unused JIT loaded models</span>
          <Switch
            className="tide-switch"
            checked={settings.autoUnloadJitModels}
            label="Auto unload unused JIT loaded models"
            onChange={(autoUnloadJitModels) =>
              update({ autoUnloadJitModels })
            }
          />
        </div>

        <InputField
          label={
            <span className="server-setting-label">
              <TimerReset size={14} strokeWidth={1.9} aria-hidden="true" />
              <span>Max idle TTL (minutes)</span>
            </span>
          }
          layout="inline"
          compact
          type="number"
          min={1}
          value={settings.maxIdleTtlMinutes}
          onChange={(event) =>
            update({ maxIdleTtlMinutes: Number(event.target.value) })
          }
        />

        <div className="server-settings-dialog__row">
          <span>Only Keep Last JIT Loaded Model</span>
          <Switch
            className="tide-switch"
            checked={settings.onlyKeepLastJitModel}
            label="Only keep last JIT loaded model"
            onChange={(onlyKeepLastJitModel) =>
              update({ onlyKeepLastJitModel })
            }
          />
        </div>

        <p className="server-settings-dialog__note">
          Port, network binding, authentication, and CORS are server launch
          settings. JIT and MCP policies are TideStudio server-manager behavior.
        </p>
      </div>
    </Modal>
  );
}
