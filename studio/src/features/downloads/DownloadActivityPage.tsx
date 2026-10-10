import { CheckCircle2, Download } from "lucide-react";
import { useMemo } from "react";
import type { DownloadActivity } from "./types";

type Props = {
  activities: DownloadActivity[];
  onClearCompleted: () => void;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit >= 3 ? 2 : unit >= 2 ? 1 : 0)} ${units[unit]}`;
}

function progressPercent(activity: DownloadActivity): number | null {
  if (!activity.totalBytes || activity.totalBytes <= 0) return null;
  return Math.min(100, Math.round((activity.downloadedBytes / activity.totalBytes) * 100));
}

function displayName(repoId: string): string {
  return repoId.split("/").pop() || repoId;
}

export function DownloadActivityPage({ activities, onClearCompleted }: Props) {
  const active = useMemo(
    () => activities.filter((activity) => activity.status === "downloading"),
    [activities],
  );
  const completed = useMemo(
    () => activities
      .filter((activity) => activity.status === "completed")
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [activities],
  );

  return (
    <div className="download-activity-page">
      <header className="download-activity-page__header">
        <div>
          <h1>Downloads</h1>
          <p>{active.length > 0 ? `${active.length} active download${active.length === 1 ? "" : "s"}` : "Manage your model downloads"}</p>
        </div>
      </header>

      <div className="download-activity-page__body">
        <div className="download-activity-page__content">
          <section className="download-activity-page__section" aria-label="Active downloads">
            <div className="download-activity-page__section-heading">
              <h2>Active</h2>
              <span>{active.length}</span>
            </div>
            {active.length > 0 ? (
              <div className="download-activity-list">
                {active.map((activity) => {
                  const percent = progressPercent(activity);
                  return (
                    <article className="download-activity-card" key={activity.downloadId}>
                      <div className="download-activity-card__top">
                        <div className="download-activity-card__identity">
                          <div className="download-activity-card__icon">
                            <Download size={18} strokeWidth={1.9} aria-hidden="true" />
                          </div>
                          <div>
                            <strong title={activity.repoId}>{displayName(activity.repoId)}</strong>
                            <span title={activity.filename}>{activity.filename}</span>
                          </div>
                        </div>
                        <span className="download-activity-card__percent">
                          {percent === null ? "..." : `${percent}%`}
                        </span>
                      </div>
                      <div
                        className="download-activity-card__track"
                        role="progressbar"
                        aria-label={`Download progress for ${activity.filename}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent ?? undefined}
                      >
                        <div
                          className="download-activity-card__bar"
                          style={{ width: percent === null ? "8%" : `${Math.max(percent, 1)}%` }}
                        />
                      </div>
                      <div className="download-activity-card__metrics">
                        <div>
                          <span>Speed</span>
                          <strong>{activity.speedBytesPerSecond > 0 ? `${formatBytes(activity.speedBytesPerSecond)}/s` : "Starting"}</strong>
                        </div>
                        <div>
                          <span>Downloaded</span>
                          <strong>
                            {formatBytes(activity.downloadedBytes)}
                            {activity.totalBytes ? ` / ${formatBytes(activity.totalBytes)}` : ""}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="download-activity-page__empty">No active downloads.</div>
            )}
          </section>

          <section className="download-activity-page__section" aria-label="Completed downloads">
            <div className="download-activity-page__section-heading">
              <h2>Completed</h2>
              {completed.length > 0 ? (
                <button className="download-activity-section__clear" type="button" onClick={onClearCompleted}>
                  Clear completed
                </button>
              ) : null}
            </div>
            {completed.length > 0 ? (
              <div className="download-activity-completed">
                {completed.map((activity) => (
                  <div className="download-activity-completed__row" key={activity.downloadId}>
                    <CheckCircle2 size={18} strokeWidth={1.9} aria-hidden="true" />
                    <div>
                      <strong title={activity.repoId}>{displayName(activity.repoId)}</strong>
                      <span title={activity.filename}>{activity.filename}</span>
                    </div>
                    <span>{formatBytes(activity.downloadedBytes)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="download-activity-page__empty">
                {active.length > 0 ? "Completed downloads will appear here." : "No completed downloads yet."}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
