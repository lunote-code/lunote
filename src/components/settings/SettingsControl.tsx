import type { ReactNode } from 'react'

type SettingsControlProps = {
  children: ReactNode
  wide?: boolean
}

export function SettingsControl({ children, wide = false }: SettingsControlProps) {
  return <div className={`settings-control${wide ? ' settings-control-wide' : ''}`}>{children}</div>
}
