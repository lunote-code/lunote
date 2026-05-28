import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import type { ResolvedPos } from '@tiptap/pm/model'

export type CodeBlockTextRange = {
  blockPos: number
  contentFrom: number
  contentTo: number
  offset: number
}

function isDocPosInRange(doc: PmNode, pos: number): boolean {
  return Number.isInteger(pos) && pos >= 0 && pos <= doc.content.size
}

/** codeBlock node at `blockPos` in the document; returns null for illegal or stale positions (no error thrown)*/
export function codeBlockNodeAt(editor: Editor, blockPos: number | null | undefined): PmNode | null {
  if (blockPos == null) return null
  const doc = editor.state.doc
  if (!isDocPosInRange(doc, blockPos)) return null
  try {
    const n = doc.nodeAt(blockPos)
    return n?.type.name === 'codeBlock' ? n : null
  } catch {
    return null
  }
}

/**
 * NodeView `getPos()` may be temporarily stale after the document is changed; check getPos first, otherwise parse the codeBlock it belongs to from the current selection.
 */
export function resolveOwnedCodeBlockPos(
  editor: Editor,
  blockPosFromView: number | null | undefined,
): number | null {
  const fromView = codeBlockNodeAt(editor, blockPosFromView)
  if (blockPosFromView != null && fromView) return blockPosFromView

  const range = resolveCodeBlockTextRange(editor.state.selection.$from)
  if (!range) return null
  return codeBlockNodeAt(editor, range.blockPos) ? range.blockPos : null
}

/** Whether the selection falls within the content area of the specified codeBlock*/
export function selectionInCodeBlockAt($from: ResolvedPos, blockPos: number, blockNode: PmNode): boolean {
  const contentFrom = blockPos + 1
  const contentTo = blockPos + blockNode.nodeSize - 1
  return $from.pos >= contentFrom && $from.pos <= contentTo
}

/** Parse the text range and block offset of the cursor within codeBlock*/
export function resolveCodeBlockTextRange($from: ResolvedPos): CodeBlockTextRange | null {
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name !== 'codeBlock') continue
    const blockPos = $from.before(d)
    const contentFrom = $from.start(d)
    const contentTo = $from.end(d)
    return {
      blockPos,
      contentFrom,
      contentTo,
      offset: $from.pos - contentFrom,
    }
  }
  return null
}

/** Calculate the current line number based on the document selection (1-based)*/
export function caretLineInCodeBlock(editor: Editor, blockPos: number | null | undefined): number | null {
  const ownedPos = resolveOwnedCodeBlockPos(editor, blockPos)
  if (ownedPos == null) return null
  const block = codeBlockNodeAt(editor, ownedPos)
  if (!block) return null
  const { $from } = editor.state.selection
  if (!selectionInCodeBlockAt($from, ownedPos, block)) return null
  const range = resolveCodeBlockTextRange($from)
  if (!range || range.blockPos !== ownedPos) return null
  const doc = editor.state.doc
  const to = range.contentFrom + range.offset
  if (!isDocPosInRange(doc, range.contentFrom) || !isDocPosInRange(doc, to) || to < range.contentFrom) {
    return null
  }
  try {
    const text = doc.textBetween(range.contentFrom, to, '\n', '\n')
    return Math.max(1, text.replace(/\r\n/g, '\n').split('\n').length)
  } catch {
    return null
  }
}
