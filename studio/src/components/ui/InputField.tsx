import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

type InputFieldLayout = "stacked" | "inline";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: ReactNode;
  hint?: ReactNode;
  layout?: InputFieldLayout;
  compact?: boolean;
};

export function InputField({
  label,
  hint,
  layout = "stacked",
  compact = false,
  id,
  ...props
}: Props) {
  const fieldClassName = [
    "ui-input-field",
    layout === "inline" ? "ui-input-field--inline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inputClassName = [
    "ui-input",
    compact ? "ui-input--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={fieldClassName} htmlFor={id}>
      <span className="ui-input-field__label">{label}</span>
      <input className={inputClassName} id={id} {...props} />
      {hint ? <span className="ui-input-field__hint">{hint}</span> : null}
    </label>
  );
}
