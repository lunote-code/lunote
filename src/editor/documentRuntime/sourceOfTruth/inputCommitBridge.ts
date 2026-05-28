import type { Editor } from '@tiptap/core'

import { getPmMetaForBlock } from '../../codeBlockRuntime/bridge/pmBlockRegistry'
import { newPatchCommitId } from '../../codeBlockRuntime/kernel'
import { isNativeInputComposing } from '../nativeInput/nativeInputRuntime'
import { commitCbrUi, commitInputChange } from './unifiedCommitEngine'

/**
 * Native input → Unified Commit Engine (direct writing of blockMap/PM is prohibited).
 */
export function commitInputDraft(
  blockId: string,
  draft: string,
  editor?: Editor | null,
): boolean {
  const meta = getPmMetaForBlock(blockId)
  const commitId = meta?.commitId ?? newPatchCommitId()
  const channel = isNativeInputComposing() ? 'ime' : 'input'
  const result = commitInputChange({
    blockId,
    changes: { draft },
    commitId,
    channel,
    editor,
  })
  return result.applied
}

export function commitInputMode(
  blockId: string,
  mode: import('../../codeBlockRuntime/types').CodeBlockMode,
): boolean {
  const meta = getPmMetaForBlock(blockId)
  const commitId = meta?.commitId ?? newPatchCommitId()
  return commitCbrUi(blockId, { mode }, commitId).applied
}
