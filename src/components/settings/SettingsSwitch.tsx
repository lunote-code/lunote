type SettingsSwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function SettingsSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      className="settings-switch"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="settings-switch-thumb" aria-hidden="true" />
    </button>
  )
}
