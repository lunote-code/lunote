import type { Editor } from '@tiptap/core'

import { notifyLocalDraftPatch } from '../../codeBlockRuntime/collab/collaborativeBridge'
import type { BlockPatch } from '../../codeBlockRuntime/kernel/blockPatch'
import { pushRuntimeSnapshot } from '../../codeBlockRuntime/kernel/runtimeHistory'
import { createRuntimeSnapshot } from '../../codeBlockRuntime/kernel/runtimeSnapshot'
import type { CommitChannel } from './runtimeTruthGraph'
import { publishCanonicalSnapshot } from './runtimeSourceCoordinator'
import { scanDivergence, type DivergenceReport } from './divergenceDetector'

export type ConvergenceContext = {
  channel: CommitChannel
  patches: BlockPatch[]
  changedBlockIds: string[]
  editor?: Editor | null
}

let lastDivergence: DivergenceReport[] = []

export function getLastDivergenceReports(): readonly DivergenceReport[] {
  return lastDivergence
}

/**
 * After canonical commit: refresh snapshot, converge derived layer, and detect divergence.
 */
export function convergeAfterCommit(ctx: ConvergenceContext): void {
  const snap = publishCanonicalSnapshot(createRuntimeSnapshot())

  for (const blockId of ctx.changedBlockIds) {
    const patch = ctx.patches.find((p) => p.blockId === blockId)
    if (
      patch &&
      (ctx.channel === 'input' || ctx.channel === 'ime' || ctx.channel === 'paste') &&
      patch.changes.draft !== undefined
    ) {
      notifyLocalDraftPatch(blockId, patch.changes.draft, patch.commitId)
    }
  }

  if (ctx.channel !== 'pm-derived' && ctx.channel !== 'undo' && ctx.channel !== 'redo') {
    pushRuntimeSnapshot(snap)
  }

  lastDivergence = ctx.editor ? scanDivergence(ctx.editor, ctx.changedBlockIds) : scanDivergence(null, ctx.changedBlockIds)
}

export function resetConvergenceLayer(): void {
  lastDivergence = []
}
