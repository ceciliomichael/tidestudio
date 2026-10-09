import { X } from "lucide-react";
import {
  useEffect,
  type ReactNode,
} from "react";
import { IconButton } from "./IconButton";

type Props = {
  title: string;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  overlayClassName?: string;
};

export function Modal({
  title,
  open,
  children,
  onClose,
  className = "",
  overlayClassName = "",
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={["ui-modal-overlay", overlayClassName].filter(Boolean).join(" ")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={["ui-modal", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ui-modal__header">
          <strong>{title}</strong>
          <IconButton
            className="ui-modal__close"
            icon={X}
            label="Close"
            size={16}
            onClick={onClose}
          />
        </header>
        {children}
      </section>
    </div>
  );
}
