import type { CollaborationSnapshot, PresenceRecord, RemoteCursor, RemoteViewport } from './types'
import { getCollaborationSession } from './collaborationLifecycle'
import { getReconciliationEpoch } from './runtimeDistributedClock'

let snapshot: CollaborationSnapshot = emptySnapshot()
const listeners = new Set<() => void>()
const appliedPatchIds = new Set<string>()

function emptySnapshot(): CollaborationSnapshot {
  return {
    revision: 0,
    epoch: 0,
    session: null,
    presence: [],
    cursors: [],
    selections: [],
    viewports: [],
    workspaceEpoch: 0,
    graphEpoch: 0,
    appliedPatchCount: 0,
  }
}

function bump(partial?: Partial<CollaborationSnapshot>): void {
  snapshot = {
    ...snapshot,
    ...partial,
    revision: snapshot.revision + 1,
    epoch: getReconciliationEpoch(),
    session: getCollaborationSession(),
  }
  listeners.forEach((fn) => fn())
}

export function getCollaborationSnapshot(): Readonly<CollaborationSnapshot> {
  return snapshot
}

export function subscribeCollaborationSnapshot(listener: () => void): () => void {
  listeners.add(listener)
  queueMicrotask(() => listener())
  return () => listeners.delete(listener)
}

export function markPatchApplied(patchId: string): void {
  appliedPatchIds.add(patchId)
  bump({ appliedPatchCount: appliedPatchIds.size })
}

export function hasPatchApplied(patchId: string): boolean {
  return appliedPatchIds.has(patchId)
}

export function getAppliedPatchIds(): ReadonlySet<string> {
  return appliedPatchIds
}

export function updatePresenceSnapshot(presence: PresenceRecord[]): void {
  bump({ presence: [...presence] })
}

export function updateCursorsSnapshot(cursors: RemoteCursor[]): void {
  bump({ cursors: [...cursors] })
}

export function updateSelectionsSnapshot(selections: RemoteCursor[]): void {
  bump({ selections: [...selections] })
}

export function updateViewportsSnapshot(viewports: RemoteViewport[]): void {
  bump({ viewports: [...viewports] })
}

export function bumpWorkspaceEpoch(): void {
  bump({ workspaceEpoch: snapshot.workspaceEpoch + 1 })
}

export function bumpGraphEpoch(): void {
  bump({ graphEpoch: snapshot.graphEpoch + 1 })
}

export function restoreCollaborationSnapshot(next: CollaborationSnapshot): void {
  snapshot = { ...next, revision: next.revision ?? 0 }
  appliedPatchIds.clear()
  listeners.forEach((fn) => fn())
}

export function clearAppliedPatches(): void {
  appliedPatchIds.clear()
}

export function resetCollaborationSnapshot(): void {
  snapshot = emptySnapshot()
  appliedPatchIds.clear()
  listeners.clear()
}
