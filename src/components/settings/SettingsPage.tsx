import type { ReactNode } from 'react'

type SettingsPageProps = {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

export function SettingsPage({ title, description, children }: SettingsPageProps) {
  return (
    <div className="settings-page">
      {title || description ? (
        <header className="settings-page-header">
          {title ? <h3 className="settings-page-title">{title}</h3> : null}
          {description ? <p className="settings-page-description">{description}</p> : null}
        </header>
      ) : null}
      <div className="settings-page-body">{children}</div>
    </div>
  )
}
