import { useCallback, useState } from 'react'

import type { TranslateFn } from '../../i18n'

const STORAGE_KEY = 'luna:sidebar-onboarding-dismissed'

type Props = {
  t: TranslateFn
}

export function SidebarWorkspaceOnboarding({ t }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true)
  }, [])

  if (dismissed) return null

  return (
    <div className="sidebar-workspace-onboarding">
      <p className="sidebar-workspace-onboarding-label">{t('app.sidebar.onboarding.label')}</p>
      <ol className="sidebar-workspace-onboarding-steps">
        <li>{t('app.sidebar.onboarding.step1')}</li>
        <li>{t('app.sidebar.onboarding.step2')}</li>
        <li>{t('app.sidebar.onboarding.step3')}</li>
      </ol>
      <button type="button" className="sidebar-workspace-onboarding-dismiss" onClick={dismiss}>
        {t('app.sidebar.onboarding.dismiss')}
      </button>
    </div>
  )
}
