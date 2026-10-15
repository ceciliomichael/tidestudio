interface SwitchProps {
  checked: boolean
  className?: string
  disabled?: boolean
  label?: string
  onChange: (checked: boolean) => void
}

export function Switch({ checked, className = '', disabled = false, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={['tide-switch', className].filter(Boolean).join(' ')}
    >
      <span />
    </button>
  )
}
