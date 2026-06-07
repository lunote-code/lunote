import { useLayoutEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { readRecentFilesFromStorage } from '../../lib/recentFilesStorage'
import { isValidRecentFilePath } from '../../lib/workspacePathUtils'
import { useI18n } from '../../i18n/provider'
import { usesNativeMacAppMenu } from '../../app/shellPlatform'
import {
  getRegisteredMacNativeAppMenu,
  installMacNativeAppMenu,
  syncMacNativeFullscreenChecked,
} from '../../platform/tauri/macNativeAppMenu'
import { syncRecentMenu } from '../../platform/tauri/platformShellService'

/** Upgrade Rust boot menu with icons as early as possible (before AppRoot mounts). */
export function MacNativeMenuEarlyUpgrade() {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  useLayoutEffect(() => {
    if (!usesNativeMacAppMenu()) return

    let cancelled = false

    void (async () => {
      const recentFiles = readRecentFilesFromStorage().filter(isValidRecentFilePath).slice(0, 8)
      await syncRecentMenu(recentFiles)

      const fullscreenChecked = await getCurrentWindow().isFullscreen()
      await installMacNativeAppMenu({
        t: tRef.current,
        recentFiles,
        fullscreenChecked,
      })

      if (cancelled) return
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}

/** Keep fullscreen checkbox in sync after early upgrade. */
export function useMacNativeFullscreenSync(enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled) return

    let cancelled = false
    let unlisten: (() => void) | undefined

    void (async () => {
      const win = getCurrentWindow()
      const off = await win.onResized(async () => {
        if (cancelled) return
        const checked = await win.isFullscreen()
        await syncMacNativeFullscreenChecked(getRegisteredMacNativeAppMenu(), checked)
      })
      if (cancelled) {
        off()
        return
      }
      unlisten = off
      const checked = await win.isFullscreen()
      if (cancelled) {
        unlisten?.()
        unlisten = undefined
        return
      }
      await syncMacNativeFullscreenChecked(getRegisteredMacNativeAppMenu(), checked)
    })()

    return () => {
      cancelled = true
      const off = unlisten
      unlisten = undefined
      off?.()
    }
  }, [enabled])
}
