import { useEffect, useRef } from 'react'

import { useI18n } from '../../i18n/provider'
import { isTauri } from '@tauri-apps/api/core'
import { installQuickCapture } from '../../platform/tauri/quickCapture'

export type QuickCaptureHookDeps = {
  onOpenTodayDailyNote: () => void | Promise<void>
  onQuit?: () => void | Promise<void>
  onStatus?: (message: string, tone?: 'info' | 'warning' | 'error' | 'success' | 'neutral') => void
}

/** System tray + global shortcut for opening today's daily note. */
export function useQuickCapture(deps: QuickCaptureHookDeps): void {
  const { t } = useI18n()
  const onOpenRef = useRef(deps.onOpenTodayDailyNote)
  onOpenRef.current = deps.onOpenTodayDailyNote
  const onQuitRef = useRef(deps.onQuit)
  onQuitRef.current = deps.onQuit
  const onStatusRef = useRef(deps.onStatus)
  onStatusRef.current = deps.onStatus

  useEffect(() => {
    if (!isTauri()) return
    void installQuickCapture({
      t,
      onOpenTodayDailyNote: () => onOpenRef.current(),
      onQuit: () => onQuitRef.current?.(),
      onStatus: (message, tone) => onStatusRef.current?.(message, tone),
    }).catch((error) => {
      console.warn('[quick-capture] install failed', error)
      onStatusRef.current?.(t('app.status.trayUnavailable'), 'warning')
    })
  }, [t])
}
