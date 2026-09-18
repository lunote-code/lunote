import { useEffect, useRef, type ReactNode } from 'react'
import type { PrefsTabId } from './types'
import { bindOverlayScrollbarReveal } from '../app/overlayScrollbarReveal'

type Props = {
  tabId: PrefsTabId
  children: ReactNode
}

export function PreferencesTabPanel({ tabId, children }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!bodyRef.current) return
    return bindOverlayScrollbarReveal(bodyRef.current)
  }, [tabId])

  return (
    <div
      className="prefs-content"
      role="tabpanel"
      id={`prefs-panel-${tabId}`}
      aria-labelledby={`prefs-tab-${tabId}`}
    >
      <div ref={bodyRef} key={tabId} className="prefs-content-body prefs-panel-animate">
        {children}
      </div>
    </div>
  )
}
