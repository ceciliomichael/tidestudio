import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle, Download, LoaderCircle, RefreshCw, Square } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import {
  cancelInferenceRuntimeInstall,
  getRuntimes,
  getRuntimePreferences,
  installInferenceRuntime,
  removeInferenceRuntime,
  setPreferredRuntime,
  type InferenceRuntime,
  type RuntimePreferences,
  type RuntimeInstallProgress,
} from "../../lib/tauri";

type CatalogState = "loading" | "ready" | "error";
type BusyAction = "install" | "remove" | null;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return value.toFixed(unit === 0 ? 0 : 1) + " " + units[unit];
}

function runtimeDescription(runtime: InferenceRuntime): string {
  if (runtime.id === "llama-cuda") return "NVIDIA GPU acceleration · Included with TideStudio";
  switch (runtime.accelerator) {
    case "cuda": return "GPU acceleration for compatible NVIDIA graphics cards";
    case "rocm": return "GPU acceleration for supported AMD graphics cards";
    case "vulkan": return "Cross-vendor GPU acceleration for AMD, Intel and NVIDIA";
    default: return "CPU inference without a dedicated graphics card";
  }
}

function percent(current: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.floor(current / total * 100)));
}

const loadingRows = [
  { titleWidth: "110px", descriptionWidth: "345px", actionWidth: "90px" },
  { titleWidth: "138px", descriptionWidth: "324px", actionWidth: "90px" },
  { titleWidth: "155px", descriptionWidth: "365px", actionWidth: "96px" },
  { titleWidth: "145px", descriptionWidth: "335px", actionWidth: "96px" },
  { titleWidth: "133px", descriptionWidth: "310px", actionWidth: "96px" },
] as const;

function RuntimeLoading() {
  return (
    <div className="runtime-settings__groups" aria-hidden="true">
      {groups.map((group) => (
        <section className="runtime-settings__group" key={group.engine}>
          <div className="runtime-settings__group-heading">
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <span>4 runtimes</span>
          </div>
          <div className="runtime-settings__list">
            {loadingRows.map((row, index) => (
              <div className="runtime-settings__item" key={index}>
                <div className="runtime-settings__item-main">
                  <div className="runtime-settings__identity">
                    <div className="runtime-settings__skeleton runtime-settings__skeleton-title" style={{ width: row.titleWidth }} />
                    <div className="runtime-settings__skeleton runtime-settings__skeleton-description" style={{ width: row.descriptionWidth }} />
                    <div className="runtime-settings__meta">
                      <div className="runtime-settings__skeleton runtime-settings__skeleton-status" />
                      <div className="runtime-settings__skeleton runtime-settings__skeleton-version" />
                    </div>
                  </div>
                  <div className="runtime-settings__actions">
                    <div
                      className="runtime-settings__skeleton runtime-settings__skeleton-action"
                      style={{ width: row.actionWidth }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RuntimeTransfer({ progress }: { progress: RuntimeInstallProgress }) {
  const downloading = progress.status === "downloading";
  const finalizing = ["verifying", "extracting", "installing", "installed"].includes(progress.status);
  const hasOverall = progress.totalBytes !== null && progress.totalBytes > 0;
  const value = hasOverall
    ? percent(progress.downloadedBytes, progress.totalBytes)
    : percent(progress.fileDownloadedBytes, progress.fileTotalBytes);
  const label = progress.status === "preparing" ? "Preparing download"
    : progress.status === "verifying" ? "Verifying package"
    : progress.status === "extracting" ? "Extracting package"
    : progress.status === "installing" ? "Finishing installation"
    : progress.status === "installed" ? "Installed"
    : downloading ? "Downloading" : "Preparing download";
  const packageLabel = progress.archiveCount > 1 && progress.archiveNumber > 0
    ? " · Package " + progress.archiveNumber + " of " + progress.archiveCount : "";
  const metrics = hasOverall
    ? formatBytes(progress.downloadedBytes) + " / " + formatBytes(progress.totalBytes!)
    : progress.fileTotalBytes
      ? formatBytes(progress.fileDownloadedBytes) + " / " + formatBytes(progress.fileTotalBytes)
      : progress.fileDownloadedBytes > 0 ? formatBytes(progress.fileDownloadedBytes) : "";

  return (
    <div className="runtime-settings__transfer" role="status">
      <div className="runtime-settings__transfer-heading">
        <span>{label + packageLabel}</span>
        <strong className="runtime-settings__percent">
          {value !== null ? value + "%" : finalizing ? "Downloaded" : "In progress"}
        </strong>
      </div>
      <div
        className={"runtime-settings__track" + (value === null && downloading ? " is-indeterminate" : "")}
        role="progressbar"
        aria-label={hasOverall ? "Overall download progress" : "Current package download progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
      >
        <div className="runtime-settings__track-fill" style={value !== null ? { width: value + "%" } : undefined} />
      </div>
      {downloading && metrics ? (
        <div className="runtime-settings__transfer-footer">
          <span>{metrics}</span>
          {!hasOverall && progress.archiveCount > 1 ? <span>Current package</span> : null}
        </div>
      ) : null}
    </div>
  );
}

const groups = [
  { engine: "llama.cpp", title: "llama.cpp", description: "General-purpose GGUF inference" },
  { engine: "PrismML", title: "PrismML", description: "Bonsai and specialized GGUF inference" },
] as const;

export function RuntimeSettings() {
  const [runtimes, setRuntimes] = useState<InferenceRuntime[]>([]);
  const [preferences, setPreferences] = useState<RuntimePreferences>({
    llamaCpp: "auto",
    prismMl: "auto",
  });
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [progress, setProgress] = useState<RuntimeInstallProgress | null>(null);
  const [operationError, setOperationError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [switchingEngine, setSwitchingEngine] = useState("");

  async function refresh(showLoading = true) {
    if (showLoading) setCatalogState("loading");
    setCatalogError("");
    try {
      const [available, selected] = await Promise.all([
        getRuntimes(),
        getRuntimePreferences(),
      ]);
      setRuntimes(available);
      setPreferences(selected);
      setCatalogState("ready");
    } catch (cause) {
      setCatalogError(String(cause));
      setCatalogState("error");
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([getRuntimes(), getRuntimePreferences()]).then(([available, selected]) => {
      if (!active) return;
      setRuntimes(available);
      setPreferences(selected);
      setCatalogState("ready");
    }).catch((cause) => {
      if (!active) return;
      setCatalogError(String(cause));
      setCatalogState("error");
    });
    let unlisten: (() => void) | undefined;
    void listen<RuntimeInstallProgress>("runtime-install-progress", (event) => {
      if (active) setProgress(event.payload);
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  async function install(id: string) {
    setOperationError("");
    setBusyId(id);
    setBusyAction("install");
    setCancelling(false);
    setProgress({
      id, status: "preparing", downloadedBytes: 0, totalBytes: null,
      archiveNumber: 0, archiveCount: 0, archiveName: null,
      fileDownloadedBytes: 0, fileTotalBytes: null,
    });
    try {
      await installInferenceRuntime(id);
      await refresh(false);
    } catch (cause) {
      if (!String(cause).toLowerCase().includes("cancelled")) setOperationError(String(cause));
    } finally {
      setBusyId("");
      setBusyAction(null);
      setProgress(null);
      setCancelling(false);
    }
  }

  async function remove(id: string) {
    setOperationError("");
    setBusyId(id);
    setBusyAction("remove");
    try {
      await removeInferenceRuntime(id);
      await refresh(false);
    } catch (cause) {
      setOperationError(String(cause));
    } finally {
      setBusyId("");
      setBusyAction(null);
    }
  }

  async function cancel(id: string) {
    setCancelling(true);
    try {
      await cancelInferenceRuntimeInstall(id);
    } catch (cause) {
      setCancelling(false);
      setOperationError(String(cause));
    }
  }

  async function chooseRuntime(engine: string, id: string) {
    setOperationError("");
    setSwitchingEngine(engine);
    try {
      setPreferences(await setPreferredRuntime(engine, id));
    } catch (cause) {
      setOperationError(String(cause));
    } finally {
      setSwitchingEngine("");
  }
  }

  return (
    <div className="settings-content settings-content--runtimes">
      <section className="settings-section runtime-settings">
        <div className="runtime-settings__header">
          <div className="runtime-settings__header-copy">
            <h2>Inference Runtimes</h2>
            <p className="runtime-settings__intro">
              Choose a preferred runtime for each inference engine. New models use
              that runtime when compatible and automatically fall back when needed.
            </p>
          </div>
          {catalogState === "loading" ? (
            <span className="runtime-settings__detecting" role="status">
              <LoaderCircle size={14} className="runtime-settings__spin" aria-hidden="true" />
              Detecting...
            </span>
          ) : catalogState === "ready" ? (
            <Button className="runtime-settings__refresh" size="compact" variant="ghost" disabled={Boolean(busyId)} onClick={() => void refresh()}>
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </Button>
          ) : null}
        </div>
        {operationError ? (
          <div className="runtime-settings__notice" role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{operationError}</span>
            <button aria-label="Dismiss error" onClick={() => setOperationError("")} type="button">Dismiss</button>
          </div>
        ) : null}
        {catalogState === "loading" ? <RuntimeLoading /> : null}
        {catalogState === "error" ? (
          <div className="runtime-settings__empty" role="alert">
            <AlertCircle size={22} aria-hidden="true" />
            <strong>Could not load runtimes</strong>
            <p>{catalogError}</p>
            <Button variant="primary" size="compact" onClick={() => void refresh()}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </Button>
          </div>
        ) : null}
        {catalogState === "ready" && runtimes.length === 0 ? (
          <div className="runtime-settings__empty">
            <strong>No runtimes found</strong>
            <p>Refresh to check your installed inference engines.</p>
            <Button variant="primary" size="compact" onClick={() => void refresh()}>Try again</Button>
          </div>
        ) : null}
        {catalogState === "ready" && runtimes.length > 0 ? (
          <div className="runtime-settings__groups">
            {groups.map((group) => {
              const items = runtimes.filter((runtime) => runtime.engine === group.engine);
              if (items.length === 0) return null;
              const preferred = group.engine === "PrismML" ? preferences.prismMl : preferences.llamaCpp;
              const isSwitching = switchingEngine === group.engine;
              return (
                <section className="runtime-settings__group" key={group.engine} aria-label={group.title + " runtimes"}>
                  <div className="runtime-settings__group-heading">
                    <div>
                      <h3>{group.title}</h3>
                      <p>{group.description} · Applies to new model loads</p>
                    </div>
                    <span>{items.length} runtimes</span>
                  </div>
                  <div className="runtime-settings__list">
                    <article className="runtime-settings__item runtime-settings__auto-row">
                      <div className="runtime-settings__item-main">
                        <div className="runtime-settings__identity">
                          <strong>Automatic</strong>
                          <p>Choose the best compatible installed runtime</p>
                          <div className="runtime-settings__meta">
                            <span className="runtime-settings__status">Default selection</span>
                          </div>
                        </div>
                        <div className="runtime-settings__actions">
                          {preferred === "auto" ? (
                            <span className="runtime-settings__preferred">Preferred</span>
                          ) : (
                            <Button
                              size="compact"
                              variant="primary"
                              disabled={Boolean(busyId) || Boolean(switchingEngine)}
                              onClick={() => void chooseRuntime(group.engine, "auto")}
                            >
                              Use
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                    {items.map((runtime) => {
                      const working = busyId === runtime.id;
                      const downloading = working && busyAction === "install";
                      const current = downloading && progress?.id === runtime.id ? progress : null;
                      const status = runtime.installed ? "Installed"
                        : runtime.outdated ? "Update available"
                        : runtime.compatible ? "Available" : "Unsupported hardware";
                      const selected = preferred === runtime.id;
                      return (
                        <article className={"runtime-settings__item" + (downloading ? " is-installing" : "")} key={runtime.id}>
                          <div className="runtime-settings__item-main">
                            <div className="runtime-settings__identity">
                              <strong>{runtime.name}</strong>
                              <p>{runtimeDescription(runtime)}</p>
                              <div className="runtime-settings__meta">
                                <span className={"runtime-settings__status" + (runtime.installed ? " is-installed" : "")}>
                                  {status}
                                </span>
                                <span>{runtime.version}</span>
                                {selected && !runtime.installed ? (
                                  <span>Preferred runtime unavailable; fallback will be used</span>
                                ) : null}
                                {runtime.installed && runtime.sizeBytes > 0 ? <span>{formatBytes(runtime.sizeBytes)}</span> : null}
                              </div>
                            </div>
                            <div className="runtime-settings__actions">
                              {downloading ? (
                                <Button size="compact" variant="secondary" disabled={cancelling} onClick={() => void cancel(runtime.id)}>
                                  {cancelling ? <LoaderCircle size={14} className="runtime-settings__spin" aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}
                                  {cancelling ? "Stopping" : "Stop"}
                                </Button>
                              ) : working ? (
                                <Button size="compact" disabled><LoaderCircle size={14} className="runtime-settings__spin" aria-hidden="true" /> Removing</Button>
                              ) : runtime.installed ? (
                                <div className={"runtime-settings__split" + (selected ? " is-preferred" : "")}>
                                  <button
                                    className="runtime-settings__split-primary"
                                    type="button"
                                    disabled={selected || Boolean(busyId) || Boolean(switchingEngine) || !runtime.compatible}
                                    onClick={() => void chooseRuntime(group.engine, runtime.id)}
                                  >
                                    {selected ? "Preferred" : isSwitching ? "Saving..." : "Use"}
                                  </button>
                                  <Dropdown
                                    mode="action"
                                    value=""
                                    options={[
                                      { label: "Use", value: "use" },
                                      ...(runtime.id === "llama-cuda"
                                        ? []
                                        : [{ label: "Remove", value: "remove" }]),
                                    ]}
                                    ariaLabel={"Actions for " + runtime.name}
                                    onChange={(action) => {
                                      if (action === "use") {
                                        void chooseRuntime(group.engine, runtime.id);
                                      } else {
                                        void remove(runtime.id);
                                      }
                                    }}
                                    disabled={Boolean(busyId) || Boolean(switchingEngine)}
                                    menuClassName="runtime-settings__action-menu"
                                  />
                                </div>
                              ) : (
                                <Button size="compact" variant="primary" disabled={Boolean(busyId) || Boolean(switchingEngine) || !runtime.compatible} onClick={() => void install(runtime.id)}>
                                  <Download size={14} aria-hidden="true" />
                                  {runtime.outdated ? "Update" : "Install"}
                                </Button>
                              )}
                            </div>
                          </div>
                          {current ? <RuntimeTransfer progress={current} /> : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
