import {
  CheckCircle2,
  Download,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
} from "react";
import { IconButton } from "../../components/ui/IconButton";
import type { DownloadActivity } from "./types";

type Props = {
  open: boolean;
  activities: DownloadActivity[];
  onClose: () => void;
  onClearCompleted: () => void;
};

function formatBytes(bytes: number | null) {
  if (bytes === null) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = index >= 3 ? 2 : index >= 2 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function formatSpeed(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) {
    return "Starting";
  }

  return `${formatBytes(bytesPerSecond)}/s`;
}

function progressPercent(activity: DownloadActivity) {
  if (!activity.totalBytes || activity.totalBytes <= 0) {
    return null;
  }

  return Math.min(
    100,
    Math.round((activity.downloadedBytes / activity.totalBytes) * 100),
  );
}

function displayName(repoId: string) {
  return repoId.split("/").pop() || repoId;
}

export function DownloadActivityPopover({
  open,
  activities,
  onClose,
  onClearCompleted,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => activities.filter((activity) => activity.status === "downloading"),
    [activities],
  );
  const completed = useMemo(
    () =>
      activities
        .filter((activity) => activity.status === "completed")
        .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0)),
    [activities],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".topbar-download-button")
      ) {
        return;
      }

      if (target instanceof Node && !panelRef.current?.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="download-activity-popover"
      ref={panelRef}
      role="dialog"
      aria-label="Downloads"
    >
      <header className="download-activity-popover__header">
        <div>
          <strong>Downloads</strong>
          <span>
            {active.length > 0
              ? `${active.length} active`
              : "No active downloads"}
          </span>
        </div>
        <IconButton
          className="download-activity-popover__close"
          icon={X}
          label="Close downloads"
          size={15}
          onClick={onClose}
        />
      </header>

      <div className="download-activity-popover__body">
        {active.length > 0 ? (
          <section className="download-activity-section">
            <div className="download-activity-section__heading">
              <span>Active</span>
            </div>

            <div className="download-activity-list">
              {active.map((activity) => {
                const percent = progressPercent(activity);

                return (
                  <article
                    className="download-activity-card"
                    key={activity.downloadId}
                  >
                    <div className="download-activity-card__top">
                      <div className="download-activity-card__identity">
                        <div className="download-activity-card__icon">
                          <Download
                            size={15}
                            strokeWidth={1.9}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <strong>{displayName(activity.repoId)}</strong>
                          <span title={activity.filename}>
                            {activity.filename}
                          </span>
                        </div>
                      </div>

                      <span className="download-activity-card__percent">
                        {percent === null ? "..." : `${percent}%`}
                      </span>
                    </div>

                    <div className="download-activity-card__track">
                      <div
                        className="download-activity-card__bar"
                        style={{
                          width:
                            percent === null
                              ? "8%"
                              : `${Math.max(percent, 1)}%`,
                        }}
                      />
                    </div>

                    <div className="download-activity-card__metrics">
                      <div>
                        <span>Speed</span>
                        <strong>
                          {formatSpeed(activity.speedBytesPerSecond)}
                        </strong>
                      </div>
                      <div>
                        <span>Downloaded</span>
                        <strong>
                          {formatBytes(activity.downloadedBytes)}
                          {activity.totalBytes
                            ? ` / ${formatBytes(activity.totalBytes)}`
                            : ""}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="download-activity-section">
          <div className="download-activity-section__heading">
            <span>Completed</span>
            {completed.length > 0 ? (
              <button
                className="download-activity-section__clear"
                type="button"
                onClick={onClearCompleted}
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="download-activity-completed">
            {completed.length === 0 ? (
              <div className="download-activity-empty">
                {active.length > 0
                  ? "Completed downloads will appear here."
                  : "No downloads yet."}
              </div>
            ) : null}

            {completed.map((activity) => (
              <div
                className="download-activity-completed__row"
                key={activity.downloadId}
              >
                <CheckCircle2
                  size={15}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <div>
                  <strong>{displayName(activity.repoId)}</strong>
                  <span title={activity.filename}>{activity.filename}</span>
                </div>
                <span>{formatBytes(activity.downloadedBytes)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
