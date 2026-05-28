import type { ReactNode } from 'react'

type SettingsCardProps = {
  children: ReactNode
  tone?: 'default' | 'accent'
  role?: string
  className?: string
}

export function SettingsCard({ children, tone = 'default', role, className }: SettingsCardProps) {
  const classes = ['settings-card', `settings-card-${tone}`, className].filter(Boolean).join(' ')
  return (
    <div className={classes} role={role}>
      {children}
    </div>
  )
}
