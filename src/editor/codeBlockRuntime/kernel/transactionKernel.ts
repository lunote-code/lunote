import type { Transaction } from '@tiptap/pm/state'

import { setPmCommitId } from '../bridge/pmBlockRegistry'
import { markCommitApplied, shouldSkipPmToCbr } from '../bridge/syncGuard'
import {
  applyPatchSilent,
  flushRuntimeEmit,
  focusBlock,
  getBlock,
  releaseRuntimeEmit,
  suppressRuntimeEmit,
} from '../codeBlockRuntimeStore'
import { newMermaidCommitId } from '../../mermaid/mermaidSourceCommitId'
import { isMermaidSourceComposing } from '../../mermaid/mermaidSourceStore'
import type { BlockPatch, BlockPatchInput, BlockPatchSource } from './blockPatch'
import { createBlockPatch, toBlockPatch } from './blockPatch'
import {
  beginBlockTransaction,
  endBlockTransaction,
  isInsideBlockTransaction,
  recordBlockPatch,
} from './blockTransaction'
import { pushRuntimeSnapshot } from './runtimeHistory'
import { createRuntimeSnapshot, type RuntimeSnapshot } from './runtimeSnapshot'

export type RunBlockTransactionOptions = {
  label?: string
  /** Write runtime history after transaction ends*/
  recordHistory?: boolean
  pmTransactions?: readonly Transaction[]
}

/**
 * Atomic batch: multiple patches within a transaction → single emit
 */
export function runBlockTransaction<T>(fn: () => T, options?: RunBlockTransactionOptions): T {
  if (isInsideBlockTransaction()) {
    return fn()
  }

  beginBlockTransaction(options?.label ?? 'block-tx')
  suppressRuntimeEmit()
  let result: T
  try {
    result = fn()
  } finally {
    const ctx = endBlockTransaction()
    releaseRuntimeEmit()
    flushRuntimeEmit()
    if (ctx && ctx.patches.length > 0 && options?.recordHistory !== false) {
      pushRuntimeSnapshot(createRuntimeSnapshot())
    }
  }
  return result
}

function applyBlockPatchCore(patch: BlockPatch): boolean {
  const block = getBlock(patch.blockId)
  if (!block && patch.changes.mode === undefined) {
    return false
  }

  if (patch.changes.draft !== undefined) {
    if (
      (patch.source === 'pm' || patch.source === 'paste') &&
      shouldSkipPmToCbr({
        blockId: patch.blockId,
        pmSource: patch.changes.draft,
        cbrDraft: block?.state.draft,
        incomingCommitId: patch.commitId,
        isComposing: isMermaidSourceComposing(),
      })
    ) {
      return false
    }
  }

  const dirty =
    patch.source === 'cbr'
      ? true
      : patch.source === 'pm' ||
          patch.source === 'undo' ||
          patch.source === 'redo' ||
          patch.source === 'paste' ||
          patch.source === 'remote'
        ? false
        : undefined

  const changed = applyPatchSilent(patch.blockId, {
    ...patch.changes,
    dirty,
  })

  if (!changed) return false

  if (patch.commitId) {
    setPmCommitId(patch.blockId, patch.commitId)
    if (
      patch.source === 'cbr' ||
      patch.source === 'pm' ||
      patch.source === 'undo' ||
      patch.source === 'redo' ||
      patch.source === 'remote'
    ) {
      markCommitApplied(patch.blockId, patch.commitId)
    }
  }

  return true
}

function applyBlockPatchSingle(patch: BlockPatch): boolean {
  if (isInsideBlockTransaction()) {
    const changed = applyBlockPatchCore(patch)
    if (changed) recordBlockPatch(patch)
    return changed
  }

  return runBlockTransaction(
    () => {
      const changed = applyBlockPatchCore(patch)
      if (changed) recordBlockPatch(patch)
      return changed
    },
    { label: `patch:${patch.blockId}`, recordHistory: patch.source !== 'cbr' },
  )
}

/**
 * Apply block patch (silent within the transaction, automatic batch outside the transaction)
 */
export function applyBlockPatch(patch: BlockPatch): boolean
export function applyBlockPatch(blockId: string, patch: BlockPatchInput): boolean
export function applyBlockPatch(
  blockIdOrPatch: string | BlockPatch,
  patchInput?: BlockPatchInput,
): boolean {
  if (typeof blockIdOrPatch === 'string') {
    if (!patchInput) return false
    return applyBlockPatchSingle(toBlockPatch(blockIdOrPatch, patchInput))
  }
  return applyBlockPatchSingle(blockIdOrPatch)
}

/** canonical alias*/
export const pushSnapshot = pushRuntimeSnapshot

export function restoreRuntimeSnapshot(
  snapshot: RuntimeSnapshot,
  source: BlockPatchSource = 'undo',
): void {
  runBlockTransaction(() => {
    for (const [blockId, block] of Object.entries(snapshot.blocks)) {
      applyBlockPatch(
        createBlockPatch(
          blockId,
          {
            draft: block.draft,
            mode: block.mode,
            height: block.height,
            scrollTop: block.scrollTop,
          },
          source,
          block.commitId,
        ),
      )
    }
    focusBlock(snapshot.focusedBlockId)
  }, { label: `restore-snapshot:${source}`, recordHistory: false })
}

/** canonical alias*/
export const restoreSnapshot = restoreRuntimeSnapshot

export function inferPmPatchSource(transactions?: readonly Transaction[]): BlockPatchSource {
  for (const tr of transactions ?? []) {
    const history = tr.getMeta('history$') as { redo?: boolean; undo?: boolean } | undefined
    if (history?.undo) return 'undo'
    if (history?.redo) return 'redo'
  }
  return 'pm'
}

export function newPatchCommitId(): string {
  return newMermaidCommitId()
}
