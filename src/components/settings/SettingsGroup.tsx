import type { ReactNode } from 'react'

type SettingsGroupProps = {
  children: ReactNode
}

export function SettingsGroup({ children }: SettingsGroupProps) {
  return <div className="settings-group">{children}</div>
}
