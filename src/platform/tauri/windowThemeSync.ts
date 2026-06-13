import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { isMacDesktopPlatform } from '../desktopPlatform'
import {
  resolveDocumentRootBackgroundHex,
  resolveWindowBackgroundHex,
} from './resolveWindowBackgroundHex'

export type WindowThemeMode = 'light' | 'dark'

export type WindowThemeSyncSnapshot = {
  mode: WindowThemeMode
  background: string
  syncedAt: number
}

export type WindowThemeSyncRecord = WindowThemeSyncSnapshot & {
  seq: number
}

export type WindowThemeSyncInconsistency = {
  index: number
  mode: WindowThemeMode
  background: string
  reason: 'mode-background-mismatch'
}

export type WindowThemeSyncOscillation = {
  startedAt: number
  endedAt: number
  modes: WindowThemeMode[]
}

export type WindowThemeSyncAnalysis = {
  inconsistentEntries: WindowThemeSyncInconsistency[]
  oscillationEvents: WindowThemeSyncOscillation[]
  totalSyncs: number
}

const MAX_SYNC_HISTORY = 64
const OSCILLATION_WINDOW_MS = 400

let lastSync: WindowThemeSyncSnapshot | null = null
let syncHistory: WindowThemeSyncRecord[] = []

/** Test / diagnostics: last window theme sync attempt (browser QA included). */
export function getLastTauriWindowThemeSync(): WindowThemeSyncSnapshot | null {
  return lastSync
}

export function getTauriWindowThemeSyncHistory(): WindowThemeSyncRecord[] {
  return [...syncHistory]
}

export function resetTauriWindowThemeSyncHistory(): void {
  syncHistory = []
  lastSync = null
}

function hexRelativeLuminance(hex: string): number | null {
  const normalized = resolveWindowBackgroundHex(hex)
  if (!normalized) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function isWindowThemeSyncConsistent(mode: WindowThemeMode, background: string): boolean {
  const lum = hexRelativeLuminance(background)
  if (lum == null) return true
  const isLightBackground = lum >= 0.45
  return (mode === 'light') === isLightBackground
}

export function analyzeWindowThemeSyncHistory(
  history: WindowThemeSyncRecord[] = syncHistory,
): WindowThemeSyncAnalysis {
  const inconsistentEntries: WindowThemeSyncInconsistency[] = []
  history.forEach((record, index) => {
    if (!isWindowThemeSyncConsistent(record.mode, record.background)) {
      inconsistentEntries.push({
        index,
        mode: record.mode,
        background: record.background,
        reason: 'mode-background-mismatch',
      })
    }
  })

  const oscillationEvents: WindowThemeSyncOscillation[] = []
  for (let i = 0; i < history.length; i++) {
    const anchor = history[i]!
    const modes: WindowThemeMode[] = [anchor.mode]
    let endAt = anchor.syncedAt
    for (let j = i + 1; j < history.length; j++) {
      const next = history[j]!
      if (next.syncedAt - anchor.syncedAt > OSCILLATION_WINDOW_MS) break
      modes.push(next.mode)
      endAt = next.syncedAt
    }
    const uniqueModes = [...new Set(modes)]
    const pingPong =
      modes.length >= 3 &&
      uniqueModes.length >= 2 &&
      modes[0] === modes[modes.length - 1]
    if (pingPong) {
      oscillationEvents.push({
        startedAt: anchor.syncedAt,
        endedAt: endAt,
        modes,
      })
    }
  }

  return {
    inconsistentEntries,
    oscillationEvents,
    totalSyncs: history.length,
  }
}

function resolveSyncBackgroundHex(backgroundColor: string): string | null {
  return (
    resolveWindowBackgroundHex(backgroundColor) ??
    resolveDocumentRootBackgroundHex()
  )
}

function recordWindowThemeSync(mode: WindowThemeMode, backgroundColor: string): void {
  const hex = resolveSyncBackgroundHex(backgroundColor)
  const snapshot: WindowThemeSyncRecord = {
    mode,
    background: hex ?? backgroundColor.trim(),
    syncedAt: Date.now(),
    seq: syncHistory.length,
  }
  lastSync = snapshot
  syncHistory.push(snapshot)
  if (syncHistory.length > MAX_SYNC_HISTORY) {
    syncHistory.shift()
  }
}

/** Keep Tauri native window chrome aligned with app surface + light/dark theme. */
export async function syncTauriWindowTheme(
  mode: WindowThemeMode,
  backgroundColor: string,
): Promise<void> {
  recordWindowThemeSync(mode, backgroundColor)
  if (!isTauri()) return

  try {
    const win = getCurrentWindow()
    const hex = resolveSyncBackgroundHex(backgroundColor)
    if (isMacDesktopPlatform()) {
      await invoke('sync_mac_native_titlebar_theme', {
        backgroundColor: hex ?? undefined,
        themeMode: mode,
      })
    }
    await win.setTheme(mode)
    if (hex) {
      await win.setBackgroundColor(hex)
    }
  } catch (error) {
    console.warn('[window-theme] Failed to sync native window theme.', {
      mode,
      backgroundColor,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
