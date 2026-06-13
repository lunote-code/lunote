import type { LunaWorkspaceSnapshot } from '../lunaPersistence'
import { workspaceIdFromRoot } from '../lunaPersistence'
import { pathsEqual } from '../lib/workspacePathUtils'
import {
  QA_BULK_WORKSPACE_ROOT,
  buildQaBulkWorkspaceFilePaths,
} from './qaBulkWorkspaceFixtures'

/** Web QA mirror of Tauri `read_luna_workspace` persistence (Playwright has no invoke). */
export const QA_STARTUP_WEB_SNAPSHOT_PREFIX = 'Lunote:qaWorkspaceSnapshot:v1:'

export const QA_STARTUP_ROOT = '/qa-startup-vault'
export const QA_STARTUP_WELCOME = `${QA_STARTUP_ROOT}/welcome.md`
export const QA_STARTUP_NOTES = `${QA_STARTUP_ROOT}/project/notes.md`

export const QA_STARTUP_FILES = [QA_STARTUP_WELCOME, QA_STARTUP_NOTES] as const

const QA_BULK_WORKSPACE_FILES = buildQaBulkWorkspaceFilePaths()

export function qaStartupWorkspaceHasPath(path: string): boolean {
  if (!path) return false
  return (
    QA_STARTUP_FILES.some((file) => pathsEqual(file, path)) ||
    QA_BULK_WORKSPACE_FILES.some((file) => pathsEqual(file, path))
  )
}

export function workspaceIdForQaBulkRoot(): string {
  return workspaceIdFromRoot(QA_BULK_WORKSPACE_ROOT)
}

export function qaWorkspaceSnapshotStorageKey(workspaceId: string): string {
  return `${QA_STARTUP_WEB_SNAPSHOT_PREFIX}${workspaceId}`
}

export function readQaWorkspaceSnapshot(workspaceId: string): LunaWorkspaceSnapshot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(qaWorkspaceSnapshotStorageKey(workspaceId))
    if (!raw) return null
    return JSON.parse(raw) as LunaWorkspaceSnapshot
  } catch {
    return null
  }
}

export function writeQaWorkspaceSnapshot(snapshot: LunaWorkspaceSnapshot): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(qaWorkspaceSnapshotStorageKey(snapshot.workspaceId), JSON.stringify(snapshot))
}

export function workspaceIdForQaStartupRoot(): string {
  return workspaceIdFromRoot(QA_STARTUP_ROOT)
}
