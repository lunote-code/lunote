import type { Editor } from '@tiptap/core'

import { getBlock, setBlockDirty } from '../codeBlockRuntimeStore'
import { runBlockTransaction } from '../kernel'
import {
  commitMermaidSourceAtPos,
  isMermaidBlockAtPos,
  readMermaidSourceAtPos,
} from '../../mermaid/mermaidSourceCommit'
import { newMermaidCommitId } from '../../mermaid/mermaidSourceCommitId'
import { isMermaidSourceComposing } from '../../mermaid/mermaidSourceStore'
import { getPmMetaForBlock, listPmMetaBlockIds, setPmCommitId } from './pmBlockRegistry'
import { markCommitApplied, shouldSkipCbrToPm } from './syncGuard'

export type CbrFlushReason =
  | 'tab-switch'
  | 'document-switch'
  | 'serialize'
  | 'transaction'
  | 'history'
  | 'explicit'
  | 'block-switch'
  | 'document-save'

/**
 * CBR → PM: unified flush (with commitId + CBR_COMMIT_META)
 */
export function flushBlockToPm(
  editor: Editor,
  blockId: string,
  reason: CbrFlushReason,
  commitId?: string,
): boolean {
  const meta = getPmMetaForBlock(blockId)
  const runtime = getBlock(blockId)
  if (!meta || !runtime) return false
  if (editor.isDestroyed) return false
  if (!isMermaidBlockAtPos(editor, meta.pos, blockId)) return false
  if (isMermaidSourceComposing()) return false

  const id = commitId ?? meta.commitId
  if (shouldSkipCbrToPm({ blockId, expectedCommitId: id, currentCommitId: meta.commitId })) {
    return false
  }

  const draft = runtime.state.draft
  const pm = readMermaidSourceAtPos(editor, meta.pos)

  if (pm === draft) {
    const nextId = newMermaidCommitId()
    setPmCommitId(blockId, nextId)
    markCommitApplied(blockId, nextId)
    setBlockDirty(blockId, false)
    return true
  }

  if (runtime.type !== 'mermaid') return false

  const ok = commitMermaidSourceAtPos(editor, meta.pos, draft, id, {
    blockId,
    reason,
  })
  if (!ok) return false

  const nextId = newMermaidCommitId()
  setPmCommitId(blockId, nextId)
  markCommitApplied(blockId, nextId)
  setBlockDirty(blockId, false)
  return true
}

export function flushAllBlocksToPm(editor: Editor, reason: CbrFlushReason): void {
  runBlockTransaction(
    () => {
      for (const blockId of listPmMetaBlockIds()) {
        flushBlockToPm(editor, blockId, reason)
      }
    },
    { label: `flush-all:${reason}`, recordHistory: false },
  )
}
