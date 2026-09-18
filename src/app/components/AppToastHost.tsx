import { useSyncExternalStore } from 'react'
import { Icon } from '../../design-system/icons'
import { useI18n } from '../../i18n'
import type { AppStatusTone } from '../hooks/useAppStatus'
import { dismissAppToast, getAppToasts, subscribeAppToasts } from '../toast/appToastStore'
import '../styles/app-toast.css'

function toneIcon(tone: AppStatusTone) {
  switch (tone) {
    case 'success':
      return 'callout-success'
    case 'error':
      return 'callout-danger'
    case 'warning':
      return 'callout-warning'
    case 'info':
      return 'callout-info'
    default:
      return 'callout-info'
  }
}

export function AppToastHost() {
  const { t } = useI18n()
  const toasts = useSyncExternalStore(subscribeAppToasts, getAppToasts, getAppToasts)

  if (toasts.length === 0) return null

  return (
    <div className="app-toast-host" aria-live="polite" aria-relevant="additions" data-testid="app-toast-host">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast--${toast.tone}`}
          role="status"
          data-testid="app-toast"
          data-tone={toast.tone}
        >
          <Icon name={toneIcon(toast.tone)} size="sm" className="app-toast-icon" />
          <span className="app-toast-message">{toast.message}</span>
          <button
            type="button"
            className="app-toast-dismiss"
            aria-label={t('app.toast.dismiss')}
            onClick={() => dismissAppToast(toast.id)}
          >
            <Icon name="close" size="xs" stroke="strong" />
          </button>
        </div>
      ))}
    </div>
  )
}
