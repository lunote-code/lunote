import { useCallback, useRef } from 'react'

import {
  dispatchAppMenuFromTauri,
  executeManifestCommand,
  type AppMenuContext,
  type AppMenuUiDeps,
} from '../../menu'
import {
  createInitialAppMenuContext,
  createInitialAppMenuUiDeps,
  useAppCommandHosts,
  type AppCommandHostsDeps,
} from '../hooks/useAppCommandHosts'
import { useAppMenuAndShortcuts, type AppMenuAndShortcutsDeps } from '../hooks/useAppMenuAndShortcuts'
import { useMacNativeAppMenu } from '../hooks/useMacNativeAppMenu'
import { useMacNativeFullscreenSync } from '../components/MacNativeMenuEarlyUpgrade'
import { useAppBootstrap, type AppBootstrapDeps } from '../hooks/useAppBootstrap'
import { useQuickCapture } from '../hooks/useQuickCapture'

export type AppChromeControllerParams = {
  nativeMacAppMenu: boolean
  effectiveLocale: string
  commandHostsDeps: Omit<AppCommandHostsDeps, 'appMenuCtxRef' | 'paletteUiDepsRef'>
  menuShortcutsDeps: Omit<AppMenuAndShortcutsDeps, 'appMenuCtxRef' | 'paletteUiDepsRef'>
  bootstrapDeps: AppBootstrapDeps
  quickCaptureDeps: {
    onQuit: () => void | Promise<void>
    onStatus: (msg: string) => void
  }
  macMenuDeps: {
    t: AppCommandHostsDeps['t']
    recentWorkspaces: string[]
    recentFiles: string[]
  }
}

/** Menu context, command hosts, shortcuts, bootstrap, and native menu wiring extracted from AppRoot. */
export function useAppChromeController(params: AppChromeControllerParams) {
  const {
    nativeMacAppMenu,
    effectiveLocale,
    commandHostsDeps,
    menuShortcutsDeps,
    bootstrapDeps,
    quickCaptureDeps,
    macMenuDeps,
  } = params

  const appMenuCtxRef = useRef<AppMenuContext>(createInitialAppMenuContext())
  const paletteUiDepsRef = useRef<AppMenuUiDeps>(createInitialAppMenuUiDeps())

  const onFormatCommand = useCallback((commandId: string) => {
    void executeManifestCommand(commandId, appMenuCtxRef.current, paletteUiDepsRef.current)
  }, [])

  const onAppMenuBarAction = useCallback((action: string) => {
    requestAnimationFrame(() => {
      void executeManifestCommand(action, appMenuCtxRef.current, paletteUiDepsRef.current)
    })
  }, [])

  const onAppMenuBarOpenRecent = useCallback((path: string) => {
    void dispatchAppMenuFromTauri(
      () => appMenuCtxRef.current,
      { action: 'open-recent', path },
      paletteUiDepsRef.current,
    )
  }, [])

  const onAppMenuBarOpenRecentWorkspace = useCallback((path: string) => {
    void dispatchAppMenuFromTauri(
      () => appMenuCtxRef.current,
      { action: 'open-recent-workspace', path },
      paletteUiDepsRef.current,
    )
  }, [])

  useAppCommandHosts({
    appMenuCtxRef,
    paletteUiDepsRef,
    ...commandHostsDeps,
  })

  useQuickCapture({
    onOpenTodayDailyNote: () =>
      void executeManifestCommand('daily-note-open', appMenuCtxRef.current, paletteUiDepsRef.current),
    onQuit: quickCaptureDeps.onQuit,
    onStatus: quickCaptureDeps.onStatus,
  })

  const { paletteFiltered, runPaletteCommand } = useAppMenuAndShortcuts({
    appMenuCtxRef,
    paletteUiDepsRef,
    ...menuShortcutsDeps,
  })

  useMacNativeAppMenu({
    enabled: nativeMacAppMenu,
    t: macMenuDeps.t,
    recentWorkspaces: macMenuDeps.recentWorkspaces,
    recentFiles: macMenuDeps.recentFiles,
    locale: effectiveLocale,
  })

  useMacNativeFullscreenSync(nativeMacAppMenu)

  useAppBootstrap(bootstrapDeps)

  return {
    appMenuCtxRef,
    paletteUiDepsRef,
    onFormatCommand,
    onAppMenuBarAction,
    onAppMenuBarOpenRecent,
    onAppMenuBarOpenRecentWorkspace,
    paletteFiltered,
    runPaletteCommand,
  }
}
