import type { ReactNode } from 'react'
import { SettingsControl } from './SettingsControl'
import { SettingsDescription } from './SettingsDescription'
import { SettingsLabel } from './SettingsLabel'

type SettingsRowProps = {
  label: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  dataSettingId?: string
}

export function SettingsRow({ label, description, children, className, dataSettingId }: SettingsRowProps) {
  const classes = ['settings-row', className].filter(Boolean).join(' ')
  return (
    <div className={classes} data-setting-id={dataSettingId}>
      <div className="settings-row-copy">
        <SettingsLabel>{label}</SettingsLabel>
        {description ? <SettingsDescription>{description}</SettingsDescription> : null}
      </div>
      <SettingsControl>{children}</SettingsControl>
    </div>
  )
}
