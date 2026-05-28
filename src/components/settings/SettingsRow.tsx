import type { ReactNode } from 'react'
import { SettingsControl } from './SettingsControl'
import { SettingsDescription } from './SettingsDescription'
import { SettingsLabel } from './SettingsLabel'

type SettingsRowProps = {
  label: ReactNode
  description?: ReactNode
  children: ReactNode
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <SettingsLabel>{label}</SettingsLabel>
        {description ? <SettingsDescription>{description}</SettingsDescription> : null}
      </div>
      <SettingsControl>{children}</SettingsControl>
    </div>
  )
}
