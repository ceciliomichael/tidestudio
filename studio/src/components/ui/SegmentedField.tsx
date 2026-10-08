import type { LucideIcon } from "lucide-react";

export type SegmentedFieldOption<T extends string> = {
  label: string;
  value: T;
  icon?: LucideIcon;
};

type Props<T extends string> = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  options: readonly SegmentedFieldOption<T>[];
  value: T;
};

export function SegmentedField<T extends string>({
  ariaLabel,
  className = "",
  disabled = false,
  onChange,
  options,
  value,
}: Props<T>) {
  return (
    <div
      className={["ui-segmented-field", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
      data-disabled={disabled || undefined}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;

        return (
          <button
            className={
              active
                ? "ui-segmented-field__option is-active"
                : "ui-segmented-field__option"
            }
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {Icon ? (
              <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
