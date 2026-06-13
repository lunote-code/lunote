import { getLocalActorId, getVectorClock, tickLogicalClock } from './runtimeDistributedClock'
import type { DistributedRuntimePatch, PatchKind } from './types'

let patchSeq = 0

export function createDistributedPatch(
  kind: PatchKind,
  payload: unknown,
  options?: { sessionId?: string; actorId?: string; baseEpoch?: number },
): DistributedRuntimePatch {
  const patchId = `kcr-${++patchSeq}-${Date.now()}`
  return {
    patchId,
    kind,
    actorId: options?.actorId ?? getLocalActorId(),
    sessionId: options?.sessionId ?? 'default',
    logicalTime: tickLogicalClock(),
    vectorClock: { ...getVectorClock() },
    timestamp: performance.now(),
    baseEpoch: options?.baseEpoch ?? 0,
    payload,
  }
}

export function validatePatch(patch: DistributedRuntimePatch): boolean {
  if (!patch.patchId || !patch.kind || !patch.actorId) return false
  if (typeof patch.logicalTime !== 'number') return false
  return true
}

export function patchDedupKey(patch: DistributedRuntimePatch): string {
  return `${patch.kind}:${patch.patchId}`
}

export function patchSortKey(patch: DistributedRuntimePatch): string {
  const lt = String(patch.logicalTime).padStart(12, '0')
  return `${lt}:${patch.timestamp}:${patch.patchId}`
}

export function resetPatchProtocol(): void {
  patchSeq = 0
}
