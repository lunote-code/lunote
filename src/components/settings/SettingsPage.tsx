import type { ReactNode } from 'react'

type SettingsPageProps = {
  title?: ReactNode
  description?: ReactNode
  toolbar?: ReactNode
  className?: string
  children: ReactNode
}

export function SettingsPage({ title, description, toolbar, className, children }: SettingsPageProps) {
  const classes = ['settings-page', className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {title || description ? (
        <header className="settings-page-header">
          {title ? <h3 className="settings-page-title">{title}</h3> : null}
          {description ? <p className="settings-page-description">{description}</p> : null}
        </header>
      ) : null}
      {toolbar ? <div className="settings-page-toolbar">{toolbar}</div> : null}
      <div className="settings-page-body">{children}</div>
    </div>
  )
}
