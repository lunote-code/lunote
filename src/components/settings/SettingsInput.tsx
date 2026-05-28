import type { InputHTMLAttributes } from 'react'

type SettingsInputProps = InputHTMLAttributes<HTMLInputElement>

export function SettingsInput({ className = '', ...props }: SettingsInputProps) {
  return <input className={`settings-input ${className}`.trim()} {...props} />
}
