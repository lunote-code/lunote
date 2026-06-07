import { useLayoutEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Menu } from '@tauri-apps/api/menu'

import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/resolveLocale'
import { isValidRecentFilePath } from '../../lib/workspacePathUtils'
import {
  getRegisteredMacNativeAppMenu,
  installMacNativeAppMenu,
  patchMacNativeAppMenuLabels,
  registerMacNativeAppMenu,
  syncMacNativeFullscreenChecked,
} from '../../platform/tauri/macNativeAppMenu'
import { syncRecentMenu } from '../../platform/tauri/platformShellService'

export type UseMacNativeAppMenuOptions = {
  enabled: boolean
  t: TranslateFn
  recentFiles: readonly string[]
  locale: UiLocaleId
}

function recentKey(files: readonly string[]): string {
  return files.filter(isValidRecentFilePath).slice(0, 8).join('\0')
}

export function useMacNativeAppMenu({
  enabled,
  t,
  recentFiles,
  locale,
}: UseMacNativeAppMenuOptions): void {
  const menuRef = useRef<Menu | null>(null)
  const installGenRef = useRef(0)
  const prevLocaleRef = useRef(locale)
  const prevRecentKeyRef = useRef(recentKey(recentFiles))

  useLayoutEffect(() => {
    if (!enabled) {
      menuRef.current = null
      registerMacNativeAppMenu(null)
      return
    }

    const generation = ++installGenRef.current
    let cancelled = false

    void (async () => {
      const trimmedRecent = recentFiles.filter(isValidRecentFilePath).slice(0, 8)
      await syncRecentMenu(trimmedRecent)

      const fullscreenChecked = await getCurrentWindow().isFullscreen()
      const deps = { t, recentFiles: trimmedRecent, fullscreenChecked }

      const localeChanged = prevLocaleRef.current !== locale
      const recentChanged = prevRecentKeyRef.current !== recentKey(trimmedRecent)
      prevLocaleRef.current = locale
      prevRecentKeyRef.current = recentKey(trimmedRecent)

      const existing = getRegisteredMacNativeAppMenu() ?? menuRef.current

      if (existing && localeChanged && !recentChanged) {
        await patchMacNativeAppMenuLabels(existing, deps)
        await syncMacNativeFullscreenChecked(existing, fullscreenChecked)
        if (cancelled || generation !== installGenRef.current) return
        menuRef.current = existing
        return
      }

      if (existing && !recentChanged && !localeChanged) {
        await syncMacNativeFullscreenChecked(existing, fullscreenChecked)
        menuRef.current = existing
        return
      }

      const menu = await installMacNativeAppMenu(deps)
      if (cancelled || generation !== installGenRef.current) return
      menuRef.current = menu
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, locale, recentFiles, t])
}
