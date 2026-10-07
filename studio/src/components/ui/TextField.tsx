import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, ...props }: Props) {
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <input className="ui-input" id={id} {...props} />
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}
