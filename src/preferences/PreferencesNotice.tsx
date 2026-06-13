import type { ReactNode } from 'react'

type Props = {
  tone: 'muted' | 'status' | 'error'
  children: ReactNode
  role?: 'status' | 'alert'
  ariaLive?: 'polite' | 'assertive'
}

const TONE_CLASS: Record<Props['tone'], string> = {
  muted: 'prefs-empty-state',
  status: 'prefs-save-status',
  error: 'prefs-error-state',
}

export function PreferencesNotice({ tone, children, role, ariaLive }: Props) {
  return (
    <p className={TONE_CLASS[tone]} role={role} aria-live={ariaLive}>
      {children}
    </p>
  )
}
