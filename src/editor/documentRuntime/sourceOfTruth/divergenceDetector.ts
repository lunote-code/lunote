import type { Editor } from '@tiptap/core'

import { readMermaidSourceAtPos } from '../../mermaid/mermaidSourceCommit'
import { getBlock } from '../../codeBlockRuntime/codeBlockRuntimeStore'
import { getPmMetaForBlock } from '../../codeBlockRuntime/bridge/pmBlockRegistry'
import { getAuthoritativeSelection } from '../selectionRuntime'
import { getCanonicalSnapshot } from './runtimeSourceCoordinator'

export type DivergenceKind =
  | 'pm-cbr-draft'
  | 'collab-local'
  | 'selection-pm'
  | 'snapshot-stale'

export type DivergenceReport = {
  kind: DivergenceKind
  blockId: string
  message: string
  runtimeDraft?: string
  pmDraft?: string | null
}

export function detectBlockDraftDivergence(
  editor: Editor,
  blockId: string,
): DivergenceReport | null {
  const meta = getPmMetaForBlock(blockId)
  const runtime = getBlock(blockId)
  if (!meta || !runtime) return null

  const pmDraft = readMermaidSourceAtPos(editor, meta.pos)
  const cbrDraft = runtime.state.draft

  if (pmDraft === cbrDraft) return null

  return {
    kind: 'pm-cbr-draft',
    blockId,
    message: 'PM document draft differs from canonical runtime draft',
    runtimeDraft: cbrDraft,
    pmDraft,
  }
}

export function detectSnapshotDivergence(blockId: string): DivergenceReport | null {
  const snap = getCanonicalSnapshot()
  const block = snap.blocks[blockId]
  const runtime = getBlock(blockId)
  if (!block || !runtime) return null
  if (block.draft !== runtime.state.draft) {
    return {
      kind: 'snapshot-stale',
      blockId,
      message: 'Canonical snapshot out of sync with live runtime block',
      runtimeDraft: runtime.state.draft,
    }
  }
  return null
}

export function detectSelectionDivergence(): DivergenceReport | null {
  const sel = getAuthoritativeSelection()
  if (sel.realm === 'block-textarea' || sel.realm === 'block') {
    return null
  }
  return null
}

export function scanDivergence(editor: Editor | null, blockIds?: string[]): DivergenceReport[] {
  const out: DivergenceReport[] = []
  const ids = blockIds ?? Object.keys(getCanonicalSnapshot().blocks)

  for (const blockId of ids) {
    const stale = detectSnapshotDivergence(blockId)
    if (stale) out.push(stale)
    if (editor) {
      const pm = detectBlockDraftDivergence(editor, blockId)
      if (pm) out.push(pm)
    }
  }

  return out
}
