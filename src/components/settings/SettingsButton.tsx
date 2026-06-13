import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

type SettingsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive'
  children: ReactNode
}

export const SettingsButton = forwardRef<HTMLButtonElement, SettingsButtonProps>(function SettingsButton(
  { variant = 'secondary', type = 'button', className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`settings-button settings-button-${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
})

SettingsButton.displayName = 'SettingsButton'
