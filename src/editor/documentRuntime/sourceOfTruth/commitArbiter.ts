import type { BlockPatch } from '../../codeBlockRuntime/kernel/blockPatch'
import { getFocusedBlockId } from '../../codeBlockRuntime/codeBlockRuntimeStore'
import { isNativeInputActive, isNativeInputComposing, shouldRuntimeYieldToNativeInput } from '../nativeInput'
import type { CommitChannel } from './runtimeTruthGraph'

export type CommitArbitration = {
  allowed: boolean
  reason?: string
  deferPmDerived?: boolean
}

export function arbitrateCommit(
  channel: CommitChannel,
  patches: BlockPatch[],
): CommitArbitration {
  if (patches.length === 0) {
    return { allowed: false, reason: 'empty' }
  }

  if (channel === 'pm-derived') {
    for (const p of patches) {
      if (
        isNativeInputComposing() &&
        getFocusedBlockId() === p.blockId &&
        shouldRuntimeYieldToNativeInput(p.blockId)
      ) {
        return { allowed: false, reason: 'native-input-composing', deferPmDerived: true }
      }
      if (isNativeInputActive() && shouldRuntimeYieldToNativeInput(p.blockId)) {
        return { allowed: false, reason: 'native-input-active', deferPmDerived: true }
      }
    }
  }

  if (channel === 'collab') {
    for (const p of patches) {
      if (
        isNativeInputComposing() &&
        getFocusedBlockId() === p.blockId &&
        p.changes.draft !== undefined
      ) {
        return { allowed: false, reason: 'queue-collab-until-blur' }
      }
    }
  }

  return { allowed: true }
}
