import { bumpPmBlockVersion, getPmBlockVersion, setPmCommitId } from '../bridge/pmBlockRegistry'
import { markCommitApplied } from '../bridge/syncGuard'
import { getBlock } from '../codeBlockRuntimeStore'
import { createBlockPatch, runBlockTransaction } from '../kernel'
import { commitRemote } from '../../documentRuntime/sourceOfTruth'
import { getFocusedBlockId } from '../codeBlockRuntimeStore'
import { isMermaidSourceComposing } from '../../mermaid/mermaidSourceStore'
import {
  drainRemotePending,
  enqueueLocalPending,
  enqueueRemotePending,
} from './patchQueue'
import {
  markRemotePatchReconciled,
  reconcileRemotePatch,
  type ReconcileResult,
} from './reconciliation'
import type { LocalBlockPatch, RemoteBlockPatch } from './remotePatch'
import {
  clearSuspendedBlocks,
  shouldQueueRemoteDraft,
} from './runtimeAuthority'

const appliedRemotePatchIds = new Set<string>()

export { isRemotePatchSuspended, resumeRemotePatch, suspendRemotePatch } from './runtimeAuthority'

function markRemotePatchApplied(patch: RemoteBlockPatch): void {
  appliedRemotePatchIds.add(patch.patchId)
  markRemotePatchReconciled(patch)
  setPmCommitId(patch.blockId, patch.commitId)
  markCommitApplied(patch.blockId, patch.commitId)
  const nextVersion = Math.max(getPmBlockVersion(patch.blockId), patch.baseVersion + 1)
  bumpPmBlockVersion(patch.blockId, nextVersion)
}

function applyReconciledRemotePatch(patch: RemoteBlockPatch): boolean {
  const { result, changes } = reconcileRemotePatch(patch)
  if (result !== 'applied' || !changes) return false

  const commitResult = commitRemote(
    createBlockPatch(patch.blockId, changes, 'remote', patch.commitId),
  )
  if (commitResult.applied) markRemotePatchApplied(patch)
  return commitResult.applied
}

/**
 * Enqueuing remote patches; only queuing when focusing/IME, not covering textarea.
 */
export function enqueueRemotePatch(patch: RemoteBlockPatch): ReconcileResult | 'queued' {
  if (appliedRemotePatchIds.has(patch.patchId)) return 'duplicate'

  const { result: precheck } = reconcileRemotePatch(patch)
  if (precheck === 'stale' || precheck === 'duplicate') return precheck

  const focused = getFocusedBlockId()
  if (
    shouldQueueRemoteDraft(patch.blockId) ||
    (isMermaidSourceComposing() && focused === patch.blockId)
  ) {
    enqueueRemotePending(patch)
    return 'queued'
  }

  if (precheck === 'noop') {
    markRemotePatchApplied(patch)
    return 'noop'
  }

  return applyRemotePatch(patch) ? 'applied' : precheck
}

/**
 * Immediately attempts to apply a single remote patch (idempotent).
 */
export function applyRemotePatch(patch: RemoteBlockPatch): boolean {
  if (appliedRemotePatchIds.has(patch.patchId)) return false

  if (shouldQueueRemoteDraft(patch.blockId)) {
    enqueueRemotePending(patch)
    return false
  }

  let applied = false
  runBlockTransaction(
    () => {
      applied = applyReconciledRemotePatch(patch)
    },
    { label: `remote:${patch.patchId}`, recordHistory: false },
  )
  return applied
}

/**
 * blur / flush / mode-switch: deterministic replay of remote patches in the queue.
 */
export function reconcileRemoteQueue(blockId?: string): number {
  const pending = drainRemotePending(blockId)
  if (pending.length === 0) return 0

  let appliedCount = 0
  runBlockTransaction(
    () => {
      for (const patch of pending) {
        if (appliedRemotePatchIds.has(patch.patchId)) continue
        if (applyReconciledRemotePatch(patch)) appliedCount += 1
      }
    },
    { label: blockId ? `reconcile-remote:${blockId}` : 'reconcile-remote-all', recordHistory: false },
  )
  return appliedCount
}

/** Local input patch is queued (for future outbound sync)*/
export function enqueueLocalPatch(patch: LocalBlockPatch): boolean {
  return enqueueLocalPending(patch)
}

export function notifyLocalDraftPatch(blockId: string, draft: string, commitId: string): void {
  if (!getBlock(blockId)) return
  enqueueLocalPatch({
    patchId: `local:${blockId}:${Date.now()}`,
    blockId,
    changes: { draft },
    timestamp: Date.now(),
    commitId,
  })
}

export function clearCollaborativeState(blockId?: string): void {
  if (blockId) {
    clearSuspendedBlocks(blockId)
    for (const id of appliedRemotePatchIds) {
      if (id.includes(blockId)) appliedRemotePatchIds.delete(id)
    }
    return
  }
  clearSuspendedBlocks()
  appliedRemotePatchIds.clear()
}

export { applyPatchDiff, mergeDraftDeterministic } from './reconciliation'
