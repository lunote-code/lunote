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
import { sliceRecentMenuItems } from '../../lib/recentMenuNodes'
import { syncRecentMenu } from '../../platform/tauri/platformShellService'

const COMMAND_PALETTE_RECENT_STORAGE_KEY = 'luna.commandPaletteRecent'
const COMMAND_PALETTE_RECENT_LIMIT = 8
const COMMAND_PALETTE_DEFAULT_PRIORITY = [
  'view-knowledge-search',
  'view-search',
  'view-quick-switcher',
  'view-tab-switcher',
  'daily-note-open',
  'toggle-source-mode',
  'view-ai-panel',
] as const

function readRecentPaletteCommandIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(COMMAND_PALETTE_RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function recordRecentPaletteCommandId(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const next = [id, ...readRecentPaletteCommandIds().filter((existing) => existing !== id)].slice(
      0,
      COMMAND_PALETTE_RECENT_LIMIT,
    )
    window.localStorage.setItem(COMMAND_PALETTE_RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function scorePaletteCommand(command: PaletteCommandDef, query: string, recentIds: readonly string[]): number {
  const normalizedQuery = query.trim().toLowerCase()
  const recentIndex = recentIds.indexOf(command.id)
  const priorityIndex = COMMAND_PALETTE_DEFAULT_PRIORITY.indexOf(
    command.id as (typeof COMMAND_PALETTE_DEFAULT_PRIORITY)[number],
  )
  let score = 0

  if (recentIndex >= 0) score += 200 - recentIndex * 12
  if (priorityIndex >= 0) score += 120 - priorityIndex * 8
  if (!normalizedQuery) return score

  const label = command.label.toLowerCase()
  const hint = command.hint.toLowerCase()
  const keywords = command.keywords.map((keyword) => keyword.toLowerCase())
  if (command.id === normalizedQuery) score += 180
  if (label === normalizedQuery) score += 160
  if (label.startsWith(normalizedQuery)) score += 120
  if (keywords.some((keyword) => keyword === normalizedQuery)) score += 110
  if (keywords.some((keyword) => keyword.startsWith(normalizedQuery))) score += 90
  if (label.includes(normalizedQuery)) score += 60
  if (hint.includes(normalizedQuery)) score += 40
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) score += 30
  return score
}

export type AppMenuAndShortcutsDeps = {
  recentWorkspaces: string[]
  recentFiles: string[]
  saveCurrent: (manual?: boolean) => Promise<void>
  saveAsCurrent: () => Promise<void>
  toggleMainPaneMode: () => void
  pastePlainFromClipboard: (plainOnly?: boolean) => Promise<void>
  setFocusMode: Dispatch<SetStateAction<boolean>>
  globalSearchOpen: boolean
  quickSwitcherOpen: boolean
  tabSwitcherOpen: boolean
  knowledgeSearchOpen: boolean
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
  globalSearchInputRef: RefObject<HTMLInputElement | null>
  quickSwitcherInputRef: RefObject<HTMLInputElement | null>
  paletteCommandDefs: PaletteCommandDef[]
  activePathRef: RefObject<string>
  appMenuCtxRef: MutableRefObject<AppMenuContext>
  paletteUiDepsRef: MutableRefObject<AppMenuUiDeps>
}

export function useAppMenuAndShortcuts(deps: AppMenuAndShortcutsDeps) {
  const {
    recentWorkspaces,
    recentFiles,
    saveCurrent,
    saveAsCurrent,
    toggleMainPaneMode,
    pastePlainFromClipboard,
    setFocusMode,
    globalSearchOpen,
    quickSwitcherOpen,
    tabSwitcherOpen,
    knowledgeSearchOpen,
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
    globalSearchInputRef,
    quickSwitcherInputRef,
    paletteCommandDefs,
    activePathRef,
    appMenuCtxRef,
    paletteUiDepsRef,
  } = deps

  const paletteFiltered = useMemo(() => {
    const q = commandPaletteQuery.trim().toLowerCase()
    const recentIds = readRecentPaletteCommandIds()
    const filtered = !q
      ? [...paletteCommandDefs]
      : paletteCommandDefs.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.id.includes(q) ||
            c.hint.toLowerCase().includes(q) ||
            c.keywords.some((k) => k.toLowerCase().includes(q)),
        )
    return filtered.sort((a, b) => scorePaletteCommand(b, q, recentIds) - scorePaletteCommand(a, q, recentIds))
  }, [commandPaletteQuery, paletteCommandDefs])

  const runPaletteCommand = useCallback(
    async (id: string) => {
      setCommandPaletteOpen(false)
      setCommandPaletteQuery('')
      setCommandPaletteIndex(0)
      recordRecentPaletteCommandId(id)
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
    if (!globalSearchOpen) return
    globalSearchInputRef.current?.focus()
  }, [globalSearchInputRef, globalSearchOpen])

  useEffect(() => {
    if (!quickSwitcherOpen) return
    quickSwitcherInputRef.current?.focus()
  }, [quickSwitcherInputRef, quickSwitcherOpen])

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
        void paletteUiDepsRef.current.quitApp?.()
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
      isBlocked: () =>
        commandPaletteOpen ||
        globalSearchOpen ||
        quickSwitcherOpen ||
        tabSwitcherOpen ||
        knowledgeSearchOpen,
    })
    window.addEventListener('keydown', onRegistryShortcut, true)
    return () => window.removeEventListener('keydown', onRegistryShortcut, true)
  }, [
    activePathRef,
    appMenuCtxRef,
    closeTab,
    commandPaletteOpen,
    globalSearchOpen,
    quickSwitcherOpen,
    tabSwitcherOpen,
    knowledgeSearchOpen,
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
    const slice = sliceRecentMenuItems(recentWorkspaces, recentFiles, 8)
    void syncRecentMenu(slice.workspaces, slice.files)
  }, [recentFiles, recentWorkspaces])

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
    const disposeListeners = () => {
      unlistenMenu?.()
      unlistenMenu = undefined
      unlistenResized?.()
      unlistenResized = undefined
    }
    void (async () => {
      const win = getCurrentWindow()
      const offMenu = await win.listen<{ action: string; path?: string; name?: string; url?: string }>(
        'app-menu',
        (event) => {
          void dispatchAppMenuFromTauri(() => appMenuCtxRef.current, event.payload, paletteUiDepsRef.current)
        },
      )
      if (cancelled) {
        offMenu()
        return
      }
      unlistenMenu = offMenu

      const offResized = await win.onResized(() => {
        void syncViewFullscreenMenuChecked()
      })
      if (cancelled) {
        offResized()
        disposeListeners()
        return
      }
      unlistenResized = offResized

      await syncViewFullscreenMenuChecked()
    })()
    return () => {
      cancelled = true
      disposeListeners()
    }
  }, [appMenuCtxRef, paletteUiDepsRef])

  return { paletteFiltered, runPaletteCommand }
}
