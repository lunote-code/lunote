import type { TextareaHTMLAttributes } from 'react'

type SettingsTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function SettingsTextArea({ className = '', ...props }: SettingsTextAreaProps) {
  return <textarea className={`settings-textarea ${className}`.trim()} {...props} />
}
