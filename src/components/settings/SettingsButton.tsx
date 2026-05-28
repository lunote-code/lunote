import type { ButtonHTMLAttributes, ReactNode } from 'react'

type SettingsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  children: ReactNode
}

export function SettingsButton({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: SettingsButtonProps) {
  return (
    <button className={`settings-button settings-button-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
