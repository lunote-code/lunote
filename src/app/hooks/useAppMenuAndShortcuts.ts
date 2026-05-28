import { useCallback, useEffect, useMemo, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'

import {
  type AppMenuContext,
  type AppMenuUiDeps,
  type PaletteCommandDef,
  createRegistryShortcutHandler,
  dispatchAppMenuAction,
  dispatchAppMenuFromTauri,
  executeManifestCommand,
  resolvePaletteCommandId,
  syncViewFullscreenMenuChecked,
} from '../../menu'
import { openPreferencesDialog } from '../../preferences/preferencesDialogStore'
import { syncRecentMenu } from '../../platform/tauri/platformShellService'

export type AppMenuAndShortcutsDeps = {
  recentFiles: string[]
  saveCurrent: (manual?: boolean) => Promise<void>
  saveAsCurrent: () => Promise<void>
  toggleMainPaneMode: () => void
  pastePlainFromClipboard: (plainOnly?: boolean) => Promise<void>
  setFocusMode: Dispatch<SetStateAction<boolean>>
  globalSearchOpen: boolean
  aboutOpen: boolean
  setAboutOpen: Dispatch<SetStateAction<boolean>>
  closeTab: (path: string) => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>
  commandPaletteQuery: string
  setCommandPaletteQuery: Dispatch<SetStateAction<string>>
  commandPaletteIndex: number
  setCommandPaletteIndex: Dispatch<SetStateAction<number>>
  commandPaletteInputRef: RefObject<HTMLInputElement | null>
  paletteCommandDefs: PaletteCommandDef[]
  activePathRef: RefObject<string>
  appMenuCtxRef: MutableRefObject<AppMenuContext>
  paletteUiDepsRef: MutableRefObject<AppMenuUiDeps>
}

export function useAppMenuAndShortcuts(deps: AppMenuAndShortcutsDeps) {
  const {
    recentFiles,
    saveCurrent,
    saveAsCurrent,
    toggleMainPaneMode,
    pastePlainFromClipboard,
    setFocusMode,
    globalSearchOpen,
    aboutOpen,
    setAboutOpen,
    closeTab,
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteQuery,
    setCommandPaletteQuery,
    commandPaletteIndex,
    setCommandPaletteIndex,
    commandPaletteInputRef,
    paletteCommandDefs,
    activePathRef,
    appMenuCtxRef,
    paletteUiDepsRef,
  } = deps

  const paletteFiltered = useMemo(() => {
    const q = commandPaletteQuery.trim().toLowerCase()
    if (!q) return [...paletteCommandDefs]
    return paletteCommandDefs.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        c.hint.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q)),
    )
  }, [commandPaletteQuery, paletteCommandDefs])

  const runPaletteCommand = useCallback(
    async (id: string) => {
      setCommandPaletteOpen(false)
      setCommandPaletteQuery('')
      setCommandPaletteIndex(0)
      await executeManifestCommand(resolvePaletteCommandId(id), appMenuCtxRef.current, paletteUiDepsRef.current)
    },
    [
      appMenuCtxRef,
      paletteUiDepsRef,
      setCommandPaletteIndex,
      setCommandPaletteOpen,
      setCommandPaletteQuery,
    ],
  )

  useEffect(() => {
    if (!commandPaletteOpen) return
    commandPaletteInputRef.current?.focus()
  }, [commandPaletteInputRef, commandPaletteOpen])

  useEffect(() => {
    setCommandPaletteIndex((i) => {
      const max = Math.max(0, paletteFiltered.length - 1)
      return Math.min(i, max)
    })
  }, [paletteFiltered.length, commandPaletteQuery, setCommandPaletteIndex])

  useEffect(() => {
    if (!commandPaletteOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setCommandPaletteOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCommandPaletteIndex((i) => Math.min(i + 1, paletteFiltered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCommandPaletteIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = paletteFiltered[commandPaletteIndex]
        if (cmd) void runPaletteCommand(cmd.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    commandPaletteIndex,
    commandPaletteOpen,
    paletteFiltered,
    runPaletteCommand,
    setCommandPaletteIndex,
    setCommandPaletteOpen,
  ])

  useEffect(() => {
    const onRegistryShortcut = createRegistryShortcutHandler({
      executeManifestCommand: (commandId) =>
        executeManifestCommand(commandId, appMenuCtxRef.current, paletteUiDepsRef.current),
      dispatchMenuAction: (action) =>
        dispatchAppMenuAction(action, appMenuCtxRef.current, paletteUiDepsRef.current),
      onSave: () => saveCurrent(true),
      onSaveAs: () => saveAsCurrent(),
      onCloseTab: () => {
        const path = activePathRef.current
        if (path) {
          closeTab(path)
          return
        }
        if (isTauri()) void getCurrentWindow().close()
        else window.close()
      },
      onQuit: () => {
        if (isTauri()) void getCurrentWindow().close()
        else window.close()
      },
      onCloseWindow: () => {
        if (isTauri()) void getCurrentWindow().close()
      },
      onPreferences: () => openPreferencesDialog(),
      onFocusMode: () => setFocusMode((v) => !v),
      onModeToggle: () => {
        if (commandPaletteOpen) setCommandPaletteOpen(false)
        toggleMainPaneMode()
      },
      onEditorPaste: (plainOnly) => pastePlainFromClipboard(plainOnly),
      isBlocked: () => commandPaletteOpen || globalSearchOpen,
    })
    window.addEventListener('keydown', onRegistryShortcut, true)
    return () => window.removeEventListener('keydown', onRegistryShortcut, true)
  }, [
    activePathRef,
    appMenuCtxRef,
    closeTab,
    commandPaletteOpen,
    globalSearchOpen,
    paletteUiDepsRef,
    pastePlainFromClipboard,
    saveAsCurrent,
    saveCurrent,
    setCommandPaletteOpen,
    setFocusMode,
    toggleMainPaneMode,
  ])

  useEffect(() => {
    if (!isTauri()) return
    void syncRecentMenu(recentFiles)
  }, [recentFiles])

  useEffect(() => {
    if (!aboutOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aboutOpen, setAboutOpen])

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    let unlistenMenu: (() => void) | undefined
    let unlistenResized: (() => void) | undefined
    void (async () => {
      const win = getCurrentWindow()
      unlistenMenu = await win.listen<{ action: string; path?: string; name?: string; url?: string }>(
        'app-menu',
        (event) => {
          void dispatchAppMenuFromTauri(() => appMenuCtxRef.current, event.payload, paletteUiDepsRef.current)
        },
      )
      unlistenResized = await win.onResized(() => {
        void syncViewFullscreenMenuChecked()
      })
      await syncViewFullscreenMenuChecked()
      if (cancelled) {
        unlistenMenu?.()
        unlistenResized?.()
      }
    })()
    return () => {
      cancelled = true
      unlistenMenu?.()
      unlistenResized?.()
    }
  }, [appMenuCtxRef, paletteUiDepsRef])

  return { paletteFiltered, runPaletteCommand }
}
