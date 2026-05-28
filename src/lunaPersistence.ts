import { ensureLunaDirs } from './lunaPaths'
import {
  appendLunaLogLine,
  readLunaWorkspace,
  writeLunaWorkspace,
} from './platform/tauri/persistenceService'

export type LunaWorkspaceSnapshot = {
  workspaceId: string
  rootDir: string
  activePath: string | null
  openTabs: string[]
  graphViewport?: { x: number; y: number; zoom: number } | null
  backlinkPanel?: { activeDocKey?: string | null } | null
  lastNavigationTarget?: string | null
  updatedAt: number
}

const timers = new Map<string, number>()
const writeQueues = new Map<string, Promise<void>>()
const latestSnapshots = new Map<string, LunaWorkspaceSnapshot>()

export { workspaceIdFromRoot } from './lib/workspacePathUtils'

export async function readLunaWorkspaceSnapshot(
  workspaceId: string,
): Promise<LunaWorkspaceSnapshot | null> {
  await ensureLunaDirs()
  return readLunaWorkspace(workspaceId)
}

export async function writeLunaWorkspaceSnapshot(
  snapshot: LunaWorkspaceSnapshot,
): Promise<void> {
  await ensureLunaDirs()
  await writeLunaWorkspace(snapshot.workspaceId, snapshot)
}

export function scheduleLunaWorkspaceSnapshot(
  snapshot: LunaWorkspaceSnapshot,
  debounceMs = 500,
): void {
  latestSnapshots.set(snapshot.workspaceId, snapshot)
  const existing = timers.get(snapshot.workspaceId)
  if (existing != null) window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    timers.delete(snapshot.workspaceId)
    const latest = latestSnapshots.get(snapshot.workspaceId) ?? snapshot
    console.log('[NAV] workspace_snapshot_write', {
      workspaceId: latest.workspaceId,
      activePath: latest.activePath,
      openTabs: latest.openTabs.length,
      updatedAt: latest.updatedAt,
    })
    const prev = writeQueues.get(latest.workspaceId) ?? Promise.resolve()
    const next = prev
      .catch(() => undefined)
      .then(() => writeLunaWorkspaceSnapshot(latest))
    writeQueues.set(latest.workspaceId, next)
  }, debounceMs)
  timers.set(snapshot.workspaceId, timer)
}

export async function flushLunaWorkspaceSnapshotWrites(): Promise<void> {
  for (const [workspaceId, timer] of timers) {
    window.clearTimeout(timer)
    timers.delete(workspaceId)
    const latest = latestSnapshots.get(workspaceId)
    if (!latest) continue
    const prev = writeQueues.get(workspaceId) ?? Promise.resolve()
    const next = prev
      .catch(() => undefined)
      .then(() => writeLunaWorkspaceSnapshot(latest))
    writeQueues.set(workspaceId, next)
  }
  await Promise.all([...writeQueues.values()].map((task) => task.catch(() => undefined)))
}

export function appendLunaLog(line: string): void {
  void appendLunaLogLine(line)
}
