import {
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="ui-collapsible-section">
      <button
        className="ui-collapsible-section__trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ui-collapsible-section__title">
          {Icon ? <Icon size={15} strokeWidth={1.9} aria-hidden="true" /> : null}
          <span>{title}</span>
        </span>
        <ChevronDown
          className={
            open
              ? "ui-collapsible-section__chevron is-open"
              : "ui-collapsible-section__chevron"
          }
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="ui-collapsible-section__content">{children}</div>
      ) : null}
    </section>
  );
}
