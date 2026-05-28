import { useEffect, useRef } from 'react'

import type { TranslateFn } from '../../i18n'
import { getSetting } from '../../settings-runtime/settingsRuntime'
import {
  checkForAppUpdate,
  getDismissedUpdateVersion,
  openAppReleasePage,
  setDismissedUpdateVersion,
  shouldRunAutoUpdateCheck,
} from '../../update/appUpdate'

export function useAutoUpdateCheck(
  confirmAppDialog: (options: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'warning'
  }) => Promise<boolean>,
  t: TranslateFn,
): void {
  const startedRef = useRef(false)

  useEffect(() => {
    if (!shouldRunAutoUpdateCheck() || startedRef.current) return
    startedRef.current = true

    void (async () => {
      if (getSetting('updates.autoCheckEnabled') === false) return

      const result = await checkForAppUpdate()
      if (result.status !== 'update-available') return
      if (getDismissedUpdateVersion() === result.latestVersion) return

      const download = await confirmAppDialog({
        title: t('app.update.prompt.title'),
        message: t('app.update.prompt.message', { version: result.latestVersion }),
        confirmLabel: t('app.update.prompt.download'),
        cancelLabel: t('app.update.prompt.later'),
      })
      if (download) {
        await openAppReleasePage(result.releaseUrl)
      } else {
        setDismissedUpdateVersion(result.latestVersion)
      }
    })()
  }, [confirmAppDialog, t])
}
