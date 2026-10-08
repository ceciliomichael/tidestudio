import {
  BrainCircuit,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Hammer,
  Heart,
  PackageOpen,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
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

function readmeExcerpt(readme: string | null) {
  if (!readme) return [];

  const lines = readme.split("\n");
  const cleaned: string[] = [];
  let inFrontmatter = lines[0]?.trim() === "---";

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];

    if (inFrontmatter) {
      if (index > 0 && raw.trim() === "---") inFrontmatter = false;
      continue;
    }

    let line = raw.trim();

    if (
      !line ||
      line.startsWith("<") ||
      line.startsWith("![") ||
      line.startsWith("|")
    ) {
      if (cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }

    while (line.startsWith("#")) line = line.slice(1).trimStart();
    if (line.startsWith("- ") || line.startsWith("* ")) line = "• " + line.slice(2);

    line = line.split("**").join("");
    line = line.split("__").join("");
    line = line.split(String.fromCharCode(96)).join("");

    if (line.length > 0) cleaned.push(line);
    if (cleaned.join("\n").length > 3600) break;
  }

  return cleaned
    .join("\n")
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block.length > 20)
    .slice(0, 5);
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
}: {
  repo: HuggingFaceRepoDetails;
  files: HuggingFaceFile[];
  activities: DownloadActivity[];
  onDownload: (file: HuggingFaceFile) => void;
}) {
  const [selectedFilename, setSelectedFilename] = useState(files[0]?.filename ?? "");
  const file = files.find((candidate) => candidate.filename === selectedFilename) ?? files[0];
  if (!file) return null;

  const downloadId = repo.repoId + "::" + file.filename;
  const activity = activities.find((candidate) => candidate.downloadId === downloadId);
  const downloading = activity?.status === "downloading";
  const percent = activity ? progressPercent(activity) : null;

  return (
    <div className="download-option-card">
      <div className="download-option-card__selector">
        <Dropdown
          ariaLabel="Choose GGUF file"
          value={file.filename}
          options={files.map((candidate) => ({
            value: candidate.filename,
            label: candidate.filename + " · " + formatBytes(candidate.sizeBytes),
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
        disabled={downloading}
        onClick={() => onDownload(file)}
      >
        <Download size={12} strokeWidth={2} aria-hidden="true" />
        {downloading ? (percent === null ? "..." : percent + "%") : "Download"}
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
          Select a Hugging Face repository to inspect its model files.
        </div>
      </section>
    );
  }

  const modelFiles = repo.files.filter((file) => !file.isMmproj);
  const projectorFiles = repo.files.filter((file) => file.isMmproj);
  const capabilities = repoCapabilityHints(repo);
  const readmeBlocks = readmeExcerpt(repo.readme);

  return (
    <section className="download-inspector download-inspector--model-search">
      <header className="download-detail-header">
        <div className="download-detail-header__top">
          <div className="download-detail-header__identity">
            <PackageOpen size={17} strokeWidth={1.9} aria-hidden="true" />
            <div>
              <strong>{repo.repoId}</strong>
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
                />
              </div>
            </div>
          ) : null}
        </section>

        {downloaded?.repoId === repo.repoId && downloaded.inspection ? (
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
              <p>Repository model card from Hugging Face.</p>
            </div>
            <FileText size={15} strokeWidth={1.9} aria-hidden="true" />
          </div>

          <div className="download-readme__content">
            {readmeBlocks.length > 0 ? (
              readmeBlocks.map((block, index) => <p key={index}>{block}</p>)
            ) : (
              <p>No README content is available for this repository.</p>
            )}
          </div>
        </section>

        {downloaded?.repoId === repo.repoId && downloaded.inspectionError ? (
          <p className="download-inspector__warning">
            Download completed, but GGUF metadata inspection failed:{" "}
            {downloaded.inspectionError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
