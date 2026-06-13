import type { HTMLAttributes, ReactNode } from 'react'

type SettingsCardProps = {
  children: ReactNode
  tone?: 'default' | 'accent'
  className?: string
} & Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'tabIndex' | 'aria-pressed' | 'aria-label' | 'aria-current' | 'onClick' | 'onKeyDown'
>

export function SettingsCard({ children, tone = 'default', className, ...rest }: SettingsCardProps) {
  const classes = ['settings-card', `settings-card-${tone}`, className].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
