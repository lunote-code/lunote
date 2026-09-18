import type { Editor } from '@tiptap/core'

import { flushAllCodeBlockSessions } from './codeBlock/boundary/codeBlockSessionRegistry'
import { reconcileCodeBlockCmFocusAfterSerialize } from './codeBlock/cm/codeBlockCmPmFocusReconcile'
import { flushAllBlockSourceDraftsForSerialize } from './blockSourceDraftSerializeBridge'
import { flushAllDrawingBlocksForSerialize } from './drawing/drawingSerializeBridge'
import { commitActiveMarkdownSourceReveal } from './lunaMarkdownSourceReveal'
import { flushMermaidSourceForSerialize } from './mermaid/mermaidSourceBridge'

export type VisualEditorPreSerializeOptions = {
  preserveCodeBlockEditing?: boolean
}

/** Flush block-local drafts (Mermaid, reveal, drawing, code-block CM) before PM→markdown serialize. */
export function flushVisualEditorLocalEdits(
  editor: Editor,
  options?: VisualEditorPreSerializeOptions,
): void {
  flushAllCodeBlockSessions(editor)
  if (!options?.preserveCodeBlockEditing) {
    reconcileCodeBlockCmFocusAfterSerialize(editor)
  }
  flushMermaidSourceForSerialize(editor)
  commitActiveMarkdownSourceReveal(editor.view)
  flushAllBlockSourceDraftsForSerialize(editor)
  flushAllDrawingBlocksForSerialize(editor)
}
