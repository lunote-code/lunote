import type { ReactNode } from 'react'

export function SettingsLabel({ children }: { children: ReactNode }) {
  return <span className="settings-label">{children}</span>
}
