import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  size?: number;
};

export function IconButton({
  className = "",
  icon: Icon,
  label,
  size = 17,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      className={["ui-icon-button", className].filter(Boolean).join(" ")}
      type={type}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={size} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
