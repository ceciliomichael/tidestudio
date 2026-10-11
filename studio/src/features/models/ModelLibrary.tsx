import {
  Copy,
  ExternalLink,
  FolderOpen,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Modal } from "../../components/ui/Modal";
import {
  modelDisplayName,
  modelFileName,
  modelFolderPath,
  sameModelPath,
  type CatalogModel,
} from "./types";

type Props = {
  models: CatalogModel[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (model: CatalogModel) => Promise<void>;
  modelsRoot: string | null;
};

function normalizedPath(path: string) {
  return path.replaceAll("\\", "/");
}

function managedRelativePath(path: string) {
  const normalized = normalizedPath(path);
  const marker = "/models/";
  const index = normalized.toLowerCase().lastIndexOf(marker);
  return index >= 0 ? normalized.slice(index + marker.length) : normalized;
}

function modelIdentifier(model: CatalogModel) {
  return modelDisplayName(model.path);
}

function repositoryLink(model: CatalogModel) {
  const parts = managedRelativePath(model.path).split("/").filter(Boolean);
  if (parts.length < 3) return null;

  if (parts[0].toLowerCase() === "modelscope" && parts.length >= 4) {
    return {
      label: "Open on ModelScope",
      url: `https://modelscope.cn/models/${parts[1]}/${parts[2]}`,
    };
  }

  return {
    label: "Open on Hugging Face",
    url: `https://huggingface.co/${parts[0]}/${parts[1]}`,
  };
}

function ModelActionsMenu({
  model,
  onRequestDelete,
}: {
  model: CatalogModel;
  onRequestDelete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const repository = repositoryLink(model);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 226;
      const menuHeight = menuRef.current?.offsetHeight ?? 210;
      const left = Math.max(
        8,
        Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth),
      );
      const below = rect.bottom + 6;
      const top =
        below + menuHeight <= window.innerHeight - 8
          ? below
          : Math.max(8, rect.top - menuHeight - 6);

      setMenuPosition({ left, top });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setOpen(false);
  }

  return (
    <div
      className="model-actions"
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
    >
      <IconButton
        ref={triggerRef}
        className="model-actions__trigger"
        icon={MoreHorizontal}
        label={`Actions for ${modelDisplayName(model.path)}`}
        size={14}
        onClick={() => setOpen((current) => !current)}
      />

      {open
        ? createPortal(
        <div
          className="model-actions__menu"
          ref={menuRef}
          role="menu"
          style={menuPosition}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void revealItemInDir(model.path);
            }}
          >
            <FolderOpen size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Open in File Explorer</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void copy(modelIdentifier(model))}
          >
            <Copy size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Copy Default Identifier</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => void copy(model.path)}
          >
            <Copy size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Copy Absolute Path</span>
          </button>

          {repository ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void openUrl(repository.url);
              }}
            >
              <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{repository.label}</span>
            </button>
          ) : null}

          <div className="model-actions__divider" />

          <button
            className="model-actions__delete"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRequestDelete();
            }}
          >
            <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
          ,
          document.body,
        )
        : null}
    </div>
  );
}

export function ModelLibrary({
  models,
  selectedId,
  onSelect,
  onDelete,
  modelsRoot,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<CatalogModel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const dataBodyRef = useRef<HTMLDivElement>(null);
  const actionsBodyRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const deleteFolder = deleteTarget ? modelFolderPath(deleteTarget.path) : "";
  const deleteRootFile =
    deleteFolder !== "" &&
    modelsRoot !== null &&
    sameModelPath(deleteFolder, modelsRoot);

  function handleDataScroll() {
    const dataBody = dataBodyRef.current;
    if (!dataBody) return;
    if (
      actionsBodyRef.current &&
      actionsBodyRef.current.scrollTop !== dataBody.scrollTop
    ) {
      actionsBodyRef.current.scrollTop = dataBody.scrollTop;
    }
  }

  function handleActionsScroll() {
    const actionsBody = actionsBodyRef.current;
    if (
      actionsBody &&
      dataBodyRef.current &&
      dataBodyRef.current.scrollTop !== actionsBody.scrollTop
    ) {
      dataBodyRef.current.scrollTop = actionsBody.scrollTop;
    }
  }

  function handleHorizontalScroll() {
    const horizontalScroll = horizontalScrollRef.current;
    const layout = layoutRef.current;
    if (!horizontalScroll || !layout) return;

    layout.style.setProperty(
      "--model-catalog-scroll-x",
      `${-horizontalScroll.scrollLeft}px`,
    );
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // The parent surfaces the error; keep this confirmation open for retry.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="model-catalog">
      <header className="page-heading model-catalog__page-heading">
        <div>
          <h1>Models</h1>
          <p>GGUF models available in TideStudio&apos;s managed library.</p>
        </div>
        <span>{models.length} models</span>
      </header>

      <div className="model-catalog__table">
        <div className="model-catalog__layout" ref={layoutRef}>
          <div className="model-catalog__data-column">
            <div className="model-catalog__header-scroll">
              <div className="model-catalog__header">
                <span>Model</span>
                <span>Publisher</span>
                <span>Type</span>
                <span>Params</span>
                <span>Quant</span>
                <span>Context Length</span>
                <span>Size</span>
              </div>
            </div>

            <div
              className="model-catalog__body"
              ref={dataBodyRef}
              onScroll={handleDataScroll}
            >
              <div className="model-catalog__body-content">
                {models.length === 0 ? (
                  <div className="model-catalog__empty">
                    No GGUF models found in TideStudio&apos;s models directory.
                  </div>
                ) : null}

                {models.map((model) => (
                  <div
                    className={
                      model.id === selectedId
                        ? "model-catalog-row is-selected"
                        : model.id === hoveredId
                          ? "model-catalog-row is-hovered"
                          : "model-catalog-row"
                    }
                    key={model.id}
                    role="row"
                    tabIndex={0}
                    onPointerEnter={() => setHoveredId(model.id)}
                    onPointerLeave={() => setHoveredId(null)}
                    onClick={() => onSelect(model.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(model.id);
                      }
                    }}
                  >
                    <span className="model-catalog-row__model">
                      <strong title={modelFileName(model.path)}>{modelDisplayName(model.path)}</strong>
                    </span>

                    <span title={model.publisher}>{model.publisher}</span>

                    <span>
                      <span className="model-tag">{model.category}</span>
                    </span>

                    <span>{model.parameters}</span>
                    <span>{model.quantization}</span>
                    <span>{model.contextLength}</span>
                    <span>{model.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="model-catalog__actions-column">
            <div className="model-catalog__actions-heading">Actions</div>
            <div
              className="model-catalog__actions-body"
              ref={actionsBodyRef}
              onScroll={handleActionsScroll}
            >
              {models.map((model) => (
                <div
                  className={
                    model.id === selectedId
                      ? "model-catalog-row__actions is-selected"
                      : model.id === hoveredId
                        ? "model-catalog-row__actions is-hovered"
                        : "model-catalog-row__actions"
                  }
                  key={model.id}
                  onPointerEnter={() => setHoveredId(model.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onClick={() => onSelect(model.id)}
                >
                  <ModelActionsMenu
                    model={model}
                    onRequestDelete={() => setDeleteTarget(model)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            className="model-catalog__horizontal-scroll"
            ref={horizontalScrollRef}
            onScroll={handleHorizontalScroll}
          >
            <div className="model-catalog__horizontal-track" />
          </div>
        </div>
      </div>

      <Modal
        title="Delete Model"
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        className="model-delete-modal"
      >
        <div className="model-delete-modal__body">
          <p>
            Delete <strong>{deleteTarget ? modelDisplayName(deleteTarget.path) : ""}</strong> from
            TideStudio&apos;s managed model library?
          </p>
          <p>
            {deleteRootFile
              ? "This file is directly in the models root. Only its GGUF file and settings sidecar will be deleted; other files remain."
              : modelsRoot === null
                ? "Files in a dedicated model folder are deleted together, including mmproj and sibling GGUFs. A GGUF stored directly in the models root is deleted individually."
                : "The entire containing folder and all of its contents will be permanently deleted, including other GGUF files, mmproj files, and settings."}
          </p>
          <p className="model-delete-modal__path">
            {deleteRootFile ? deleteTarget?.path : deleteFolder}
          </p>
        </div>
        <div className="model-delete-modal__actions">
          <Button
            size="compact"
            disabled={deleting}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="compact"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
