import type {
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label: ReactNode;
  hint?: ReactNode;
};

export function TextAreaField({
  label,
  hint,
  id,
  ...props
}: Props) {
  return (
    <label className="ui-input-field" htmlFor={id}>
      <span className="ui-input-field__label">{label}</span>
      <textarea className="ui-textarea" id={id} {...props} />
      {hint ? <span className="ui-input-field__hint">{hint}</span> : null}
    </label>
  );
}
