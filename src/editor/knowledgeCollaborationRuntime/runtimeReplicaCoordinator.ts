import { resolvePatchConflict } from './collaborationConflictResolver'
import { validatePatch, patchSortKey } from './collaborationPatchProtocol'
import {
  getAppliedPatchIds,
  hasPatchApplied,
  markPatchApplied,
} from './collaborationSnapshotRuntime'
import { mergeVectorClock, isPatchStale, getLocalActorId } from './runtimeDistributedClock'
import type { DistributedRuntimePatch } from './types'

const pendingRemote: DistributedRuntimePatch[] = []
const seenKeys = new Set<string>()
let reconcilePass = 0

export type PatchApplyHandler = (patch: DistributedRuntimePatch) => void

let applyHandler: PatchApplyHandler | null = null

export function setReplicaPatchHandler(handler: PatchApplyHandler | null): void {
  applyHandler = handler
}

export function enqueueReplicaPatch(patch: DistributedRuntimePatch): boolean {
  if (!validatePatch(patch)) return false
  const key = patch.patchId
  if (seenKeys.has(key)) return false
  seenKeys.add(key)
  pendingRemote.push(patch)
  pendingRemote.sort((a, b) => patchSortKey(a).localeCompare(patchSortKey(b)))
  return true
}

export function reconcileReplicas(): number {
  reconcilePass += 1
  if (reconcilePass > 1000) {
    reconcilePass = 0
    return 0
  }

  let applied = 0
  const localActor = getLocalActorId()
  const appliedIds = getAppliedPatchIds()

  const batch = pendingRemote.splice(0, pendingRemote.length)
  for (const patch of batch) {
    if (isPatchStale(patch.baseEpoch, patch.logicalTime)) {
      seenKeys.delete(patch.patchId)
      continue
    }

    const decision = resolvePatchConflict(patch, appliedIds, localActor)
    if (decision.action === 'drop') {
      seenKeys.delete(patch.patchId)
      continue
    }
    if (decision.action === 'defer') {
      pendingRemote.push(patch)
      continue
    }

    if (hasPatchApplied(patch.patchId)) {
      seenKeys.delete(patch.patchId)
      continue
    }

    mergeVectorClock(patch.vectorClock)
    applyHandler?.(patch)
    markPatchApplied(patch.patchId)
    applied += 1
    seenKeys.delete(patch.patchId)
  }

  if (pendingRemote.length > 0 && applied === 0) {
    pendingRemote.length = 0
  }

  return applied
}

export function getPendingReplicaCount(): number {
  return pendingRemote.length
}

export function resetReplicaCoordinator(): void {
  pendingRemote.length = 0
  seenKeys.clear()
  reconcilePass = 0
  applyHandler = null
}
