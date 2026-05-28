import { bumpDocumentTick } from '../documentClock'
import { markBarrierComplete, clearCommitBarriers } from './commitBarrier'
import type { RuntimePhase } from './runtimePhase'
import { compareRuntimePhase } from './runtimePhase'
import type { RuntimeTransactionOp } from './runtimeTransaction'
import { sortOrderedTasks, nextRuntimeSequence } from './runtimeOrdering'

export type AtomicCommitSlice = {
  phase: RuntimePhase
  blockId?: string | null
  run: () => void | Promise<void>
}

let flushing = false
const stagedSlices: AtomicCommitSlice[] = []

export function stageAtomicCommit(slice: AtomicCommitSlice): void {
  stagedSlices.push(slice)
}

export async function flushAtomicCommit(): Promise<void> {
  if (flushing || stagedSlices.length === 0) return
  flushing = true
  try {
    const ordered = sortOrderedTasks(
      stagedSlices.map((s, i) => ({
        ...s,
        key: `atomic:${s.phase}:${s.blockId ?? 'doc'}:${i}`,
        priority: 0,
        sequence: nextRuntimeSequence(),
      })),
    )

    let lastPhase: RuntimePhase | null = null
    for (const slice of ordered) {
      if (lastPhase && compareRuntimePhase(slice.phase, lastPhase) < 0) {
        continue
      }
      await slice.run()
      const scope = slice.blockId ? `block:${slice.blockId}` : 'document'
      markBarrierComplete(scope, slice.phase)
      lastPhase = slice.phase
      bumpDocumentTick(
        slice.phase === 'selection'
          ? 'selection'
          : slice.phase === 'layout'
            ? 'layout'
            : slice.phase === 'viewport'
              ? 'viewport'
              : 'render',
      )
    }
    stagedSlices.length = 0
    markBarrierComplete('document', 'commit')
  } finally {
    flushing = false
  }
}

export async function commitTransactionOps(ops: RuntimeTransactionOp[]): Promise<void> {
  for (const op of ops) {
    stageAtomicCommit({
      phase: op.phase,
      blockId: op.blockId,
      run: op.run,
    })
  }
  await flushAtomicCommit()
}

export function resetAtomicCommit(): void {
  stagedSlices.length = 0
  clearCommitBarriers()
}
