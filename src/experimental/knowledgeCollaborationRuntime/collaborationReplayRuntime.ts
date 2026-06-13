import { enqueueReplicaPatch, reconcileReplicas, setReplicaPatchHandler } from './runtimeReplicaCoordinator'
import { hasPatchApplied, restoreCollaborationSnapshot } from './collaborationSnapshotRuntime'
import { patchSortKey } from './collaborationPatchProtocol'
import type { CollaborationSnapshot, DistributedRuntimePatch } from './types'

const replayLog: DistributedRuntimePatch[] = []
let replaying = false

export function logPatchForReplay(patch: DistributedRuntimePatch): void {
  if (replaying) return
  replayLog.push(patch)
  if (replayLog.length > 5000) replayLog.shift()
}

export function replayDistributedSnapshot(
  snapshot: CollaborationSnapshot,
  patches: DistributedRuntimePatch[],
  apply: (patch: DistributedRuntimePatch) => void,
): number {
  replaying = true
  setReplicaPatchHandler(apply)
  restoreCollaborationSnapshot({ ...snapshot, appliedPatchCount: 0 })

  const sorted = [...patches].sort((a, b) => patchSortKey(a).localeCompare(patchSortKey(b)))
  let applied = 0
  for (const patch of sorted) {
    if (hasPatchApplied(patch.patchId)) continue
    enqueueReplicaPatch(patch)
    applied += reconcileReplicas()
  }

  replaying = false
  setReplicaPatchHandler(apply)
  return applied
}

export function replayFromLog(apply: (patch: DistributedRuntimePatch) => void): number {
  return replayDistributedSnapshot(
    { revision: 0, epoch: 0, session: null, presence: [], cursors: [], selections: [], viewports: [], workspaceEpoch: 0, graphEpoch: 0, appliedPatchCount: 0 },
    replayLog,
    apply,
  )
}

export function getReplayLog(): readonly DistributedRuntimePatch[] {
  return replayLog
}

export function resetCollaborationReplayRuntime(): void {
  replayLog.length = 0
  replaying = false
}
