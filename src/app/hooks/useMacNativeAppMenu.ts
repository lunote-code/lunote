import { useLayoutEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Menu } from '@tauri-apps/api/menu'

import type { TranslateFn } from '../../i18n'
import type { UiLocaleId } from '../../i18n/resolveLocale'
import { sliceRecentMenuItems } from '../../lib/recentMenuNodes'
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
  recentWorkspaces: readonly string[]
  recentFiles: readonly string[]
  locale: UiLocaleId
}

function recentKey(workspaces: readonly string[], files: readonly string[]): string {
  const slice = sliceRecentMenuItems(workspaces, files, 8)
  return `${slice.workspaces.join('\0')}\n${slice.files.join('\0')}`
}

export function useMacNativeAppMenu({
  enabled,
  t,
  recentWorkspaces,
  recentFiles,
  locale,
}: UseMacNativeAppMenuOptions): void {
  const menuRef = useRef<Menu | null>(null)
  const installGenRef = useRef(0)
  const prevLocaleRef = useRef(locale)
  const prevRecentKeyRef = useRef(recentKey(recentWorkspaces, recentFiles))

  useLayoutEffect(() => {
    if (!enabled) {
      menuRef.current = null
      registerMacNativeAppMenu(null)
      return
    }

    const generation = ++installGenRef.current
    let cancelled = false

    void (async () => {
      const slice = sliceRecentMenuItems(recentWorkspaces, recentFiles, 8)
      await syncRecentMenu(slice.workspaces, slice.files)

      const fullscreenChecked = await getCurrentWindow().isFullscreen()
      const deps = {
        t,
        recentWorkspaces: slice.workspaces,
        recentFiles: slice.files,
        fullscreenChecked,
      }

      const localeChanged = prevLocaleRef.current !== locale
      const nextRecentKey = recentKey(recentWorkspaces, recentFiles)
      const recentChanged = prevRecentKeyRef.current !== nextRecentKey
      prevLocaleRef.current = locale
      prevRecentKeyRef.current = nextRecentKey

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
  }, [enabled, locale, recentFiles, recentWorkspaces, t])
}
