import {
  BrainCircuit,
  CalendarDays,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Hammer,
  Heart,
  PackageOpen,
  Wrench,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { IconButton } from "../../components/ui/IconButton";
import type {
  CapabilitySignal,
  DownloadActivity,
  DownloadedModel,
  HuggingFaceFile,
  HuggingFaceRepoDetails,
} from "./types";

type Props = {
  repo: HuggingFaceRepoDetails | null;
  loading: boolean;
  activities: DownloadActivity[];
  downloaded: DownloadedModel | null;
  onClose: () => void;
  onDownload: (file: HuggingFaceFile) => void;
  onStopDownload: (downloadId: string) => void;
};

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
};

function progressPercent(activity: DownloadActivity) {
  if (!activity.totalBytes || activity.totalBytes <= 0) return null;
  return Math.min(100, Math.round((activity.downloadedBytes / activity.totalBytes) * 100));
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return value.toFixed(index >= 3 ? 2 : 1) + " " + units[index];
}

function formatUpdated(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function repoCapabilityHints(repo: HuggingFaceRepoDetails) {
  const haystack = (
    repo.repoId + " " + (repo.pipelineTag ?? "") + " " + repo.tags.join(" ")
  ).toLowerCase();

  return [
    {
      label: "Vision",
      icon: Eye,
      visible:
        haystack.includes("vision") ||
        haystack.includes("multimodal") ||
        haystack.includes("image-text-to-text") ||
        haystack.includes("vl"),
    },
    {
      label: "Tool Use",
      icon: Wrench,
      visible:
        haystack.includes("tool-use") ||
        haystack.includes("tool_use") ||
        haystack.includes("function-calling") ||
        haystack.includes("function_calling"),
    },
    {
      label: "Reasoning",
      icon: BrainCircuit,
      visible:
        haystack.includes("reasoning") ||
        haystack.includes("thinking") ||
        haystack.includes("deepseek-r1") ||
        haystack.includes("qwen3"),
    },
    {
      label: "MTP",
      icon: Hammer,
      visible: haystack.includes("mtp"),
    },
  ].filter((capability) => capability.visible);
}

function readmeMarkdown(readme: string | null) {
  if (!readme) return "";
  const lines = readme.split("\n");
  if (lines[0]?.trim() !== "---") return readme;

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end >= 0 ? lines.slice(end + 1).join("\n").trim() : readme;
}

function hasLinkedImage(node: HastNode, insideLink = false): boolean {
  const isLink = node.type === "element" && node.tagName === "a";
  if (node.type === "element" && node.tagName === "img" && insideLink) {
    return true;
  }

  return (
    node.children?.some((child) =>
      hasLinkedImage(child, insideLink || isLink),
    ) ?? false
  );
}

function hasMeaningfulText(node: HastNode): boolean {
  if (node.type === "text") {
    return Boolean(node.value?.trim());
  }
  return node.children?.some(hasMeaningfulText) ?? false;
}

function isWhitespaceNode(node: HastNode) {
  return node.type === "text" && !node.value?.trim();
}

function isBadgeBlock(node: HastNode) {
  return hasLinkedImage(node) && !hasMeaningfulText(node);
}

function groupReadmeBadgeRows() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      node.children?.forEach(visit);
      if (!node.children?.length) return;

      const grouped: HastNode[] = [];
      let index = 0;

      while (index < node.children.length) {
        const child = node.children[index];
        if (!isBadgeBlock(child)) {
          grouped.push(child);
          index += 1;
          continue;
        }

        const badges: HastNode[] = [child];
        let cursor = index + 1;
        while (cursor < node.children.length) {
          const next = node.children[cursor];
          if (isWhitespaceNode(next)) {
            cursor += 1;
            continue;
          }
          if (!isBadgeBlock(next)) break;
          badges.push(next);
          cursor += 1;
        }

        grouped.push({
          type: "element",
          tagName: "div",
          properties: { className: ["download-readme__badge-row"] },
          children: badges,
        });
        index = cursor;
      }

      node.children = grouped;
    };

    visit(tree);
  };
}

function resolveReadmeUrl(
  repo: HuggingFaceRepoDetails,
  value: string | undefined,
  kind: "link" | "image",
) {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return "https:" + raw;
  if (kind === "image" && raw.startsWith("data:image/")) return raw;
  if (kind === "link" && raw.startsWith("#")) return raw;

  const origin =
    repo.source === "modelscope"
      ? "https://modelscope.cn"
      : "https://huggingface.co";
  if (raw.startsWith("/")) {
    return new URL(raw, origin).toString();
  }

  if (repo.source === "huggingface") {
    const mode = kind === "image" ? "resolve" : "blob";
    return new URL(
      raw,
      `https://huggingface.co/${repo.repoId}/${mode}/main/README.md`,
    ).toString();
  }

  const relative = new URL(raw, "https://modelscope.local/README.md");
  let filePath = relative.pathname.replace(/^\//, "");
  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // Keep the already-encoded path if it contains malformed percent escapes.
  }
  const asset = new URL(
    `https://modelscope.cn/api/v1/models/${repo.repoId}/repo`,
  );
  asset.searchParams.set("Revision", "master");
  asset.searchParams.set("FilePath", filePath);
  return asset.toString();
}

function repositoryPageUrl(repo: HuggingFaceRepoDetails) {
  return repo.source === "modelscope"
    ? `https://modelscope.cn/models/${repo.repoId}`
    : `https://huggingface.co/${repo.repoId}`;
}

function CapabilityRow({
  label,
  signal,
  icon: Icon,
}: {
  label: string;
  signal: CapabilitySignal;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="download-capability-row">
      <span>
        <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
        {label}
      </span>
      <strong data-supported={signal.supported}>
        {signal.supported ? "Yes · " + signal.confidence : "Not detected"}
      </strong>
    </div>
  );
}

function DownloadOptionSelector({
  repo,
  files,
  activities,
  onDownload,
  onStopDownload,
}: {
  repo: HuggingFaceRepoDetails;
  files: HuggingFaceFile[];
  activities: DownloadActivity[];
  onDownload: (file: HuggingFaceFile) => void;
  onStopDownload: (downloadId: string) => void;
}) {
  const [selectedFilename, setSelectedFilename] = useState(files[0]?.filename ?? "");
  const file = files.find((candidate) => candidate.filename === selectedFilename) ?? files[0];
  if (!file) return null;

  const downloadId =
    repo.source + "::" + repo.repoId + "::" + file.filename;
  const activity = activities.find((candidate) => candidate.downloadId === downloadId);
  const downloading = activity?.status === "downloading";
  const stopping = activity?.status === "stopping";
  const isDownloaded = file.downloaded || activity?.status === "completed";
  const percent = activity ? progressPercent(activity) : null;

  return (
    <div className="download-option-card">
      <div className="download-option-card__selector">
        <Dropdown
          ariaLabel="Choose GGUF file"
          menuClassName="ui-dropdown__menu--download"
          maxMenuHeight={260}
          value={file.filename}
          options={files.map((candidate) => ({
            value: candidate.filename,
            label: candidate.filename + " · " + formatBytes(candidate.sizeBytes),
            badge:
              candidate.downloaded ||
              activities.some(
                (activity) =>
                  activity.downloadId ===
                    repo.source + "::" + repo.repoId + "::" + candidate.filename &&
                  activity.status === "completed",
              )
                ? "Downloaded"
                : undefined,
          }))}
          onChange={setSelectedFilename}
        />
      </div>
      <div className="download-option-card__copy">
        <strong title={file.filename}>{file.filename}</strong>
        <div>
          <span className="download-option-card__format">
            {file.isMmproj ? "MMPROJ" : "GGUF"}
          </span>
          <span>{file.quantization ?? "Default"}</span>
          <span>{formatBytes(file.sizeBytes)}</span>
        </div>
      </div>

      <Button
        variant="primary"
        size="compact"
        className={downloading || stopping ? "download-option-card__progress" : ""}
        disabled={stopping || isDownloaded}
        onClick={() => {
          if (downloading) {
            onStopDownload(downloadId);
          } else {
            onDownload(file);
          }
        }}
      >
        {downloading || stopping ? (
          <X size={12} strokeWidth={2} aria-hidden="true" />
        ) : isDownloaded ? null : (
          <Download size={12} strokeWidth={2} aria-hidden="true" />
        )}
        {downloading
          ? `Stop · ${percent === null ? "..." : percent + "%"}`
          : stopping
            ? "Stopping..."
          : isDownloaded
            ? "Downloaded"
            : "Download"}
      </Button>
    </div>
  );
}

export function DownloadInspector({
  repo,
  loading,
  activities,
  downloaded,
  onClose,
  onDownload,
  onStopDownload,
}: Props) {
  if (loading) {
    return (
      <section className="download-inspector">
        <div className="download-inspector__empty">Resolving model details...</div>
      </section>
    );
  }

  if (!repo) {
    return (
      <section className="download-inspector">
        <div className="download-inspector__empty">
          Select a model repository to inspect its model files.
        </div>
      </section>
    );
  }

  const modelFiles = repo.files.filter((file) => !file.isMmproj);
  const projectorFiles = repo.files.filter((file) => file.isMmproj);
  const capabilities = repoCapabilityHints(repo);
  const readme = readmeMarkdown(repo.readme);

  return (
    <section className="download-inspector download-inspector--model-search">
      <header className="download-detail-header">
        <div className="download-detail-header__top">
          <div className="download-detail-header__identity">
            <PackageOpen size={17} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <div className="download-detail-header__title-row">
                <strong title={repo.repoId}>{repo.repoId}</strong>
                <IconButton
                  className="download-detail-header__external-link"
                  icon={ExternalLink}
                  label={`Open ${repo.repoId} in browser`}
                  size={13}
                  onClick={() => void openUrl(repositoryPageUrl(repo))}
                />
              </div>
              <span>{repo.pipelineTag ?? "GGUF repository"}</span>
            </div>
          </div>

          <IconButton
            className="download-detail-header__close"
            icon={X}
            label="Close model details"
            size={15}
            onClick={onClose}
          />
        </div>

        <div className="download-detail-stats">
          <span>
            <Download size={12} strokeWidth={1.9} aria-hidden="true" />
            {repo.downloads.toLocaleString()}
          </span>
          <span>
            <Heart size={12} strokeWidth={1.9} aria-hidden="true" />
            {repo.likes.toLocaleString()}
          </span>
          <span>
            <CalendarDays size={12} strokeWidth={1.9} aria-hidden="true" />
            {formatUpdated(repo.lastModified)}
          </span>
        </div>
      </header>

      <div className="download-detail-scroll">
        <section className="download-summary-card">
          <div className="download-summary-card__top">
            <div>
              <span>Publisher</span>
              <strong>{repo.author}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>GGUF</strong>
            </div>
            <div>
              <span>Files</span>
              <strong>{repo.files.length}</strong>
            </div>
          </div>

          <div className="download-summary-card__tags">
            {repo.pipelineTag ? <span>{repo.pipelineTag}</span> : null}
            {repo.tags
              .filter((tag) => !tag.includes(":"))
              .slice(0, 5)
              .map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
          </div>

          {capabilities.length > 0 ? (
            <div className="download-summary-card__capabilities">
              {capabilities.map(({ label, icon: Icon }) => (
                <span key={label}>
                  <Icon size={12} strokeWidth={1.9} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="download-detail-section">
          <div className="download-detail-section__heading">
            <div>
              <h3>Download Options</h3>
              <p>Download model files and projectors individually.</p>
            </div>
          </div>

          <div className="download-option-group">
            <div className="download-option-group__label">
              <span>Model GGUFs</span>
              <strong>{modelFiles.length}</strong>
            </div>

            <div className="download-option-list">
              {modelFiles.length === 0 ? (
                <div className="download-inspector__empty">No model GGUF files found.</div>
              ) : (
                <DownloadOptionSelector
                  key={repo.repoId + "-models"}
                  repo={repo}
                  files={modelFiles}
                  activities={activities}
                  onDownload={onDownload}
                  onStopDownload={onStopDownload}
                />
              )}
            </div>
          </div>

          {projectorFiles.length > 0 ? (
            <div className="download-option-group">
              <div className="download-option-group__label">
                <span>Vision Projectors</span>
                <strong>{projectorFiles.length}</strong>
              </div>

              <div className="download-option-list">
                <DownloadOptionSelector
                  key={repo.repoId + "-projectors"}
                  repo={repo}
                  files={projectorFiles}
                  activities={activities}
                  onDownload={onDownload}
                  onStopDownload={onStopDownload}
                />
              </div>
            </div>
          ) : null}
        </section>

        {downloaded?.source === repo.source &&
        downloaded.repoId === repo.repoId &&
        downloaded.inspection ? (
          <section className="download-detail-section">
            <div className="download-detail-section__heading">
              <div>
                <h3>Detected After Download</h3>
                <p>Signals read from the downloaded GGUF metadata.</p>
              </div>
            </div>

            <div className="download-capabilities">
              <div className="download-capability-row">
                <span>
                  <PackageOpen size={14} strokeWidth={1.9} aria-hidden="true" />
                  Type
                </span>
                <strong>{downloaded.inspection.capabilities.category}</strong>
              </div>
              <CapabilityRow
                label="MTP / Draft"
                signal={downloaded.inspection.capabilities.mtp}
                icon={Hammer}
              />
              <CapabilityRow
                label="Reasoning"
                signal={downloaded.inspection.capabilities.reasoning}
                icon={BrainCircuit}
              />
              <CapabilityRow
                label="Vision"
                signal={downloaded.inspection.capabilities.vision}
                icon={Eye}
              />
              <CapabilityRow
                label="Tool Calling"
                signal={downloaded.inspection.capabilities.tools}
                icon={Wrench}
              />
            </div>
          </section>
        ) : null}

        <section className="download-detail-section download-readme">
          <div className="download-detail-section__heading">
            <div>
              <h3>README</h3>
              <p>
                Repository model card from{" "}
                {repo.source === "modelscope" ? "ModelScope" : "Hugging Face"}.
              </p>
            </div>
            <FileText size={15} strokeWidth={1.9} aria-hidden="true" />
          </div>

          <div className="download-readme__content">
            {readme ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  rehypeRaw,
                  rehypeSanitize,
                  groupReadmeBadgeRows,
                ]}
                components={{
                  a: ({ node: _, href, ...props }) => (
                    <a
                      {...props}
                      href={resolveReadmeUrl(repo, href, "link")}
                      target="_blank"
                      rel="noreferrer"
                    />
                  ),
                  img: ({ node: _, src, alt, ...props }) => (
                    <img
                      {...props}
                      src={resolveReadmeUrl(repo, src, "image")}
                      alt={alt ?? ""}
                      loading="lazy"
                      decoding="async"
                    />
                  ),
                }}
              >
                {readme}
              </ReactMarkdown>
            ) : (
              <p>No README content is available for this repository.</p>
            )}
          </div>
        </section>

        {downloaded?.source === repo.source &&
        downloaded.repoId === repo.repoId &&
        downloaded.inspectionError ? (
          <p className="download-inspector__warning">
            Download completed, but GGUF metadata inspection failed:{" "}
            {downloaded.inspectionError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
