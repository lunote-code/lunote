import type { LocalBlockPatch } from './remotePatch'
import type { RemoteBlockPatch } from './remotePatch'
import { remotePatchSortKey } from './remotePatch'

function insertOrdered<T extends { patchId: string }>(
  queue: T[],
  item: T,
  sortKey: (p: T) => string,
  seen: Set<string>,
): boolean {
  if (seen.has(item.patchId)) return false
  seen.add(item.patchId)
  queue.push(item)
  queue.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  return true
}

const localPendingQueue: LocalBlockPatch[] = []
const remotePendingQueue: RemoteBlockPatch[] = []
const seenLocalPatchIds = new Set<string>()
const seenRemotePatchIds = new Set<string>()

export function enqueueLocalPending(patch: LocalBlockPatch): boolean {
  return insertOrdered(localPendingQueue, patch, (p) => `${p.timestamp}:${p.patchId}`, seenLocalPatchIds)
}

export function enqueueRemotePending(patch: RemoteBlockPatch): boolean {
  return insertOrdered(remotePendingQueue, patch, remotePatchSortKey, seenRemotePatchIds)
}

export function drainLocalPending(blockId?: string): LocalBlockPatch[] {
  return drainQueue(localPendingQueue, seenLocalPatchIds, blockId)
}

export function drainRemotePending(blockId?: string): RemoteBlockPatch[] {
  return drainQueue(remotePendingQueue, seenRemotePatchIds, blockId)
}

function drainQueue<T extends { patchId: string; blockId: string }>(
  queue: T[],
  seen: Set<string>,
  blockId?: string,
): T[] {
  const out: T[] = []
  const keep: T[] = []
  for (const item of queue) {
    if (blockId && item.blockId !== blockId) {
      keep.push(item)
      continue
    }
    out.push(item)
    seen.delete(item.patchId)
  }
  queue.length = 0
  queue.push(...keep)
  return out
}

export function peekRemotePending(blockId?: string): readonly RemoteBlockPatch[] {
  if (!blockId) return remotePendingQueue
  return remotePendingQueue.filter((p) => p.blockId === blockId)
}

export function getRemotePendingCount(blockId?: string): number {
  return peekRemotePending(blockId).length
}

export function clearPatchQueues(blockId?: string): void {
  if (!blockId) {
    localPendingQueue.length = 0
    remotePendingQueue.length = 0
    seenLocalPatchIds.clear()
    seenRemotePatchIds.clear()
    return
  }
  for (const q of [localPendingQueue, remotePendingQueue] as const) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i]!.blockId === blockId) {
        seenLocalPatchIds.delete(q[i]!.patchId)
        seenRemotePatchIds.delete(q[i]!.patchId)
        q.splice(i, 1)
      }
    }
  }
}

export function hasRemotePatchId(patchId: string): boolean {
  return seenRemotePatchIds.has(patchId)
}
