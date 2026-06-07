import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import type { ResolvedPos } from '@tiptap/pm/model'

import { lineIndexFromCharOffset } from '../model/lineModel'

export type CodeBlockTextRange = {
  blockPos: number
  contentFrom: number
  contentTo: number
  offset: number
}

export type CodeBlockContentRange = {
  blockPos: number
  contentFrom: number
  contentEnd: number
  text: string
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
 * Resolve this NodeView's codeBlock position.
 * Never map selection from another block when `blockPosFromView` is set but stale — that caused gutter flashes on siblings during typing.
 * When getPos is stale, only fall back to selection if the selected block is the same node as `viewNode` (`.eq`).
 */
export function resolveOwnedCodeBlockPos(
  editor: Editor,
  blockPosFromView: number | null | undefined,
  viewNode?: PmNode | null,
): number | null {
  if (blockPosFromView != null) {
    const fromView = codeBlockNodeAt(editor, blockPosFromView)
    if (fromView) return blockPosFromView
    if (viewNode) {
      const range = resolveCodeBlockTextRange(editor.state.selection.$from)
      if (range) {
        const atSel = codeBlockNodeAt(editor, range.blockPos)
        if (atSel?.eq(viewNode)) return range.blockPos
      }
    }
    return null
  }

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

/** Resolve document text range for a NodeView-owned code block (for coords-based gutter layout). */
export function resolveCodeBlockContentRange(
  editor: Editor,
  blockDocPos: number | null | undefined,
  ownedBlockPos: number | null | undefined,
  viewNode: PmNode,
  fallbackText: string,
): CodeBlockContentRange | null {
  let blockPos = ownedBlockPos ?? blockDocPos ?? null
  let block = blockPos != null ? codeBlockNodeAt(editor, blockPos) : null

  if (!block || (viewNode && !block.eq(viewNode))) {
    block = null
    blockPos = null
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name !== 'codeBlock' || !n.eq(viewNode)) return undefined
      blockPos = pos
      block = n
      return false
    })
  }

  if (blockPos == null || !block) return null

  const contentFrom = blockPos + 1
  const contentEnd = blockPos + block.nodeSize - 1
  if (contentEnd <= contentFrom) return null

  const text = editor.state.doc.textBetween(contentFrom, contentEnd, '\n', '\n') || fallbackText
  return { blockPos, contentFrom, contentEnd, text }
}

/** Calculate the current line number based on the document selection (1-based)*/
export function caretLineInCodeBlock(
  editor: Editor,
  blockPos: number | null | undefined,
  viewNode?: PmNode | null,
): number | null {
  const ownedPos = resolveOwnedCodeBlockPos(editor, blockPos, viewNode)
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
    const text = block.textBetween(0, block.content.size, '\n', '\n')
    return lineIndexFromCharOffset(text, range.offset)
  } catch {
    return null
  }
}
