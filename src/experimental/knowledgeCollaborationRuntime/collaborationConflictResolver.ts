import { compareVectorClocks } from './runtimeDistributedClock'
import type { DistributedRuntimePatch } from './types'

export type MergeResult =
  | { action: 'apply' }
  | { action: 'drop'; reason: string }
  | { action: 'defer' }

export function resolvePatchConflict(
  incoming: DistributedRuntimePatch,
  applied: ReadonlySet<string>,
  localActorId: string,
): MergeResult {
  if (applied.has(incoming.patchId)) {
    return { action: 'drop', reason: 'duplicate' }
  }

  if (incoming.actorId === localActorId && incoming.kind !== 'awareness') {
    return { action: 'drop', reason: 'echo-local' }
  }

  return { action: 'apply' }
}

export function mergeConcurrentPatches(
  a: DistributedRuntimePatch,
  b: DistributedRuntimePatch,
): DistributedRuntimePatch {
  const order = compareVectorClocks(a.vectorClock, b.vectorClock)
  if (order === 'before') return b
  if (order === 'after') return a
  return a.logicalTime >= b.logicalTime ? a : b
}
