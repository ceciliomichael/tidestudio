import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "success";

type Props = {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
};

export function StatusBadge({ icon: Icon, label, tone = "neutral" }: Props) {
  return (
    <div className={`ui-status-badge ui-status-badge--${tone}`}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
