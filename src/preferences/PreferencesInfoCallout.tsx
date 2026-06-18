import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  dismissLabel?: string
  onDismiss?: () => void
  role?: 'status' | 'note'
}

export function PreferencesInfoCallout({ children, dismissLabel, onDismiss, role = 'status' }: Props) {
  return (
    <div className="settings-info-callout settings-info-callout--inline" role={role}>
      <p className="settings-info-callout-text">{children}</p>
      {dismissLabel && onDismiss ? (
        <button type="button" className="settings-info-callout-dismiss" onClick={onDismiss}>
          {dismissLabel}
        </button>
      ) : null}
    </div>
  )
}
