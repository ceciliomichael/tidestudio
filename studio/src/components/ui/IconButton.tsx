import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  size?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  function IconButton(
    {
      className = "",
      icon: Icon,
      label,
      size = 17,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={["ui-icon-button", className].filter(Boolean).join(" ")}
        type={type}
        aria-label={label}
        title={label}
        {...props}
      >
        <Icon size={size} strokeWidth={2} aria-hidden="true" />
      </button>
    );
  },
);
