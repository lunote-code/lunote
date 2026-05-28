import type { ReactNode } from 'react'

export function SettingsDescription({ children }: { children: ReactNode }) {
  return <p className="settings-description">{children}</p>
}
