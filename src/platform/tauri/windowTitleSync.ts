import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type WindowTitleSyncSnapshot = {
  documentTitle: string
  workspaceTitle: string
  formatted: string
  syncedAt: number
}

let lastSync: WindowTitleSyncSnapshot | null = null

export function getLastTauriWindowTitleSync(): WindowTitleSyncSnapshot | null {
  return lastSync
}

export function buildWindowTitle(
  documentTitle: string,
  workspaceTitle: string,
  fallbackAppName = 'Lunote',
): string {
  const doc = documentTitle.trim()
  const workspace = workspaceTitle.trim()
  if (doc && workspace) return `${doc} — ${workspace}`
  if (doc) return doc
  if (workspace) return workspace
  return fallbackAppName.trim() || 'Lunote'
}

/** Sync native window / document title with active note + workspace. */
export async function syncTauriWindowTitle(
  documentTitle: string,
  workspaceTitle: string,
  fallbackAppName = 'Lunote',
): Promise<void> {
  const formatted = buildWindowTitle(documentTitle, workspaceTitle, fallbackAppName)
  lastSync = {
    documentTitle: documentTitle.trim(),
    workspaceTitle: workspaceTitle.trim(),
    formatted,
    syncedAt: Date.now(),
  }

  if (typeof document !== 'undefined') {
    document.title = formatted
  }
  if (!isTauri()) return

  try {
    await getCurrentWindow().setTitle(formatted)
  } catch (error) {
    console.warn('[window-title] Failed to sync native window title.', {
      documentTitle,
      workspaceTitle,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
