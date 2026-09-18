import { useLayoutEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { readRecentFilesFromStorage } from '../../lib/recentFilesStorage'
import { sliceRecentMenuItems } from '../../lib/recentMenuNodes'
import { readRecentWorkspacesFromStorage } from '../../lib/recentWorkspacesStorage'
import { isValidRecentFilePath, isValidRecentWorkspacePath } from '../../lib/workspacePathUtils'
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
      const slice = sliceRecentMenuItems(
        readRecentWorkspacesFromStorage().filter(isValidRecentWorkspacePath),
        readRecentFilesFromStorage().filter(isValidRecentFilePath),
        8,
      )
      await syncRecentMenu(slice.workspaces, slice.files)

      const fullscreenChecked = await getCurrentWindow().isFullscreen()
      await installMacNativeAppMenu({
        t: tRef.current,
        recentWorkspaces: slice.workspaces,
        recentFiles: slice.files,
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
