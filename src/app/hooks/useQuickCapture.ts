import { useEffect, useRef } from 'react'

import { useI18n } from '../../i18n/provider'
import { isTauri } from '@tauri-apps/api/core'
import { installQuickCapture } from '../../platform/tauri/quickCapture'

export type QuickCaptureHookDeps = {
  onOpenTodayDailyNote: () => void | Promise<void>
}

/** System tray + global shortcut for opening today's daily note. */
export function useQuickCapture(deps: QuickCaptureHookDeps): void {
  const { t } = useI18n()
  const onOpenRef = useRef(deps.onOpenTodayDailyNote)
  onOpenRef.current = deps.onOpenTodayDailyNote

  useEffect(() => {
    if (!isTauri()) return
    void installQuickCapture({
      t,
      onOpenTodayDailyNote: () => onOpenRef.current(),
    }).catch((error) => {
      console.warn('[quick-capture] install failed', error)
    })
  }, [t])
}
