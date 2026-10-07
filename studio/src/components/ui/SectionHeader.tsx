import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  compact = false,
}: Props) {
  return (
    <div className={compact ? "ui-section-header is-compact" : "ui-section-header"}>
      <div className="ui-section-header__main">
        {Icon ? (
          <div className="ui-section-header__icon" aria-hidden="true">
            <Icon size={16} strokeWidth={2} />
          </div>
        ) : null}
        <div className="ui-section-header__copy">
          {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? (
            <p className="ui-section-description">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="ui-section-header__action">{action}</div> : null}
    </div>
  );
}
