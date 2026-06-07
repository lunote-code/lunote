import { forwardRef, type InputHTMLAttributes } from 'react'

type SettingsInputProps = InputHTMLAttributes<HTMLInputElement>

export const SettingsInput = forwardRef<HTMLInputElement, SettingsInputProps>(function SettingsInput(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} className={`settings-input ${className}`.trim()} {...props} />
})
