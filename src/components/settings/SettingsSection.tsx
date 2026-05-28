import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h4 className="settings-section-title">{title}</h4>
        {description ? <p className="settings-section-description">{description}</p> : null}
      </header>
      {children ? <div className="settings-section-body">{children}</div> : null}
    </section>
  )
}
