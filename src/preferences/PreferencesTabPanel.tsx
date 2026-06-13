import type { ReactNode } from 'react'
import type { PrefsTabId } from './types'

type Props = {
  tabId: PrefsTabId
  children: ReactNode
}

export function PreferencesTabPanel({ tabId, children }: Props) {
  return (
    <div
      className="prefs-content"
      role="tabpanel"
      id={`prefs-panel-${tabId}`}
      aria-labelledby={`prefs-tab-${tabId}`}
    >
      <div key={tabId} className="prefs-content-body prefs-panel-animate">
        {children}
      </div>
    </div>
  )
}
