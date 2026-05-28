import type { BlockPatchChanges } from '../kernel/blockPatch'
import type { RemoteBlockPatch } from './remotePatch'
import { getBlock } from '../codeBlockRuntimeStore'
import { getLastAppliedCommitId } from '../bridge/syncGuard'
import { canApplyRemoteField, isRemotePatchStale } from './runtimeAuthority'
const appliedRemoteCommitByBlock = new Map<string, string>()

export function isRemotePatchDuplicate(patch: RemoteBlockPatch): boolean {
  const last = appliedRemoteCommitByBlock.get(patch.blockId)
  if (last && last === patch.commitId) return true
  return false
}

export function markRemotePatchReconciled(patch: RemoteBlockPatch): void {
  appliedRemoteCommitByBlock.set(patch.blockId, patch.commitId)
}

export function clearRemoteReconciliation(blockId?: string): void {
  if (blockId) appliedRemoteCommitByBlock.delete(blockId)
  else appliedRemoteCommitByBlock.clear()
}

/**
 * CRDT-ready: Merge remote changes, do not directly replace draft.
 * Deterministic rules: local is retained for equality; remote is the superset of local, and remote is taken; local is the superset of remote, local is retained; otherwise remote (local has been flushed in the reconcile phase).
 */
export function mergeDraftDeterministic(localDraft: string, remoteDraft: string): string {
  if (localDraft === remoteDraft) return localDraft
  if (remoteDraft.startsWith(localDraft)) return remoteDraft
  if (localDraft.startsWith(remoteDraft)) return localDraft
  return remoteDraft
}

export function applyPatchDiff(
  blockId: string,
  remoteChanges: Partial<BlockPatchChanges>,
): BlockPatchChanges | null {
  const block = getBlock(blockId)
  const localDraft = block?.state.draft ?? ''
  const merged: BlockPatchChanges = {}
  let hasChange = false

  if (remoteChanges.mode !== undefined && canApplyRemoteField(blockId, 'mode')) {
    if (block?.state.mode !== remoteChanges.mode) {
      merged.mode = remoteChanges.mode
      hasChange = true
    }
  }

  if (remoteChanges.height !== undefined && canApplyRemoteField(blockId, 'height')) {
    if (block?.state.height !== remoteChanges.height) {
      merged.height = remoteChanges.height
      hasChange = true
    }
  }

  if (remoteChanges.scrollTop !== undefined && canApplyRemoteField(blockId, 'scrollTop')) {
    if (block?.state.scrollTop !== remoteChanges.scrollTop) {
      merged.scrollTop = remoteChanges.scrollTop
      hasChange = true
    }
  }

  if (remoteChanges.draft !== undefined && canApplyRemoteField(blockId, 'draft')) {
    const nextDraft = mergeDraftDeterministic(localDraft, remoteChanges.draft)
    if (nextDraft !== localDraft) {
      merged.draft = nextDraft
      hasChange = true
    }
  }

  return hasChange ? merged : null
}

export type ReconcileResult = 'applied' | 'ignored' | 'stale' | 'duplicate' | 'noop'

export function reconcileRemotePatch(patch: RemoteBlockPatch): {
  result: ReconcileResult
  changes: BlockPatchChanges | null
} {
  if (isRemotePatchDuplicate(patch)) {
    return { result: 'duplicate', changes: null }
  }

  if (isRemotePatchStale(patch.blockId, patch.baseVersion)) {
    return { result: 'stale', changes: null }
  }

  const last = getLastAppliedCommitId(patch.blockId)
  if (last && last === patch.commitId) {
    return { result: 'duplicate', changes: null }
  }

  const changes = applyPatchDiff(patch.blockId, patch.changes)
  if (!changes) {
    return { result: 'noop', changes: null }
  }

  return { result: 'applied', changes }
}
