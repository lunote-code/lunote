import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  id?: string
  role?: React.AriaRole
  'aria-labelledby'?: string
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  id,
  role,
  'aria-labelledby': ariaLabelledBy,
}: SettingsSectionProps) {
  const classes = ['settings-section', className].filter(Boolean).join(' ')
  return (
    <section className={classes} id={id} role={role} aria-labelledby={ariaLabelledBy}>
      {title || description ? (
        <header className="settings-section-header">
          {title ? <h4 className="settings-section-title">{title}</h4> : null}
          {description ? <p className="settings-section-description">{description}</p> : null}
        </header>
      ) : null}
      {children ? <div className="settings-section-body">{children}</div> : null}
    </section>
  )
}
