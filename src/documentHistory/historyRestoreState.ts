import { pathsEqual } from '../lib/workspacePathUtils'
import type { DocumentHistoryRestoreState } from './types'

type Listener = () => void

const restoreStateByPath = new Map<string, DocumentHistoryRestoreState>()
const listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

function matchPath(path: string): string | null {
  for (const key of restoreStateByPath.keys()) {
    if (pathsEqual(key, path)) return key
  }
  return null
}

export function suspendAutosaveForPath(path: string, snapshotId: string): void {
  if (!path) return
  const key = matchPath(path) ?? path
  restoreStateByPath.set(key, {
    path: key,
    snapshotId,
    restoredAt: Date.now(),
    autosaveSuspended: true,
    reason: 'history-restore',
  })
  notify()
}

export function resumeAutosaveForPath(path: string): void {
  const key = matchPath(path)
  if (!key) return
  restoreStateByPath.delete(key)
  notify()
}

export function isAutosaveSuspended(path: string): boolean {
  return matchPath(path) != null
}

export function getHistoryRestoreState(path: string): DocumentHistoryRestoreState | null {
  const key = matchPath(path)
  return key ? (restoreStateByPath.get(key) ?? null) : null
}

export function clearAllHistoryRestoreState(): void {
  if (restoreStateByPath.size === 0) return
  restoreStateByPath.clear()
  notify()
}

export function subscribeHistoryRestoreState(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
