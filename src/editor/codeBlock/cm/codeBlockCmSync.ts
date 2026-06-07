import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { codeBlockNodeAt } from '../behavior/selection'
import { normalizeCodeBlockText } from '../model/lineModel'

import { CODE_BLOCK_CM_ORIGIN_META } from './codeBlockCmDefer'

export type ApplyCodeBlockTextFromCmOptions = {
  addToHistory?: boolean
}

export type CodeBlockTextPatchRange = {
  from: number
  to: number
  insert: string
}

/** Smallest single replace range between two normalized code block bodies. */
export function computeCodeBlockTextPatchRange(current: string, next: string): CodeBlockTextPatchRange | null {
  const normalized = normalizeCodeBlockText(next)
  if (current === normalized) return null
  let start = 0
  const minLen = Math.min(current.length, normalized.length)
  while (start < minLen && current.charCodeAt(start) === normalized.charCodeAt(start)) start += 1
  let endCur = current.length
  let endNext = normalized.length
  while (
    endCur > start &&
    endNext > start &&
    current.charCodeAt(endCur - 1) === normalized.charCodeAt(endNext - 1)
  ) {
    endCur -= 1
    endNext -= 1
  }
  return { from: start, to: endCur, insert: normalized.slice(start, endNext) }
}

/** Map a document offset through a single text replace patch. */
export function mapOffsetThroughTextPatch(
  offset: number,
  from: number,
  to: number,
  insertLength: number,
): number {
  if (offset < from) return offset
  if (offset <= to) return from + insertLength
  return offset + insertLength - (to - from)
}

export type CodeBlockContentRange = {
  blockPos: number
  contentFrom: number
  contentTo: number
}

/** Document positions for code block inline text (exclusive end). */
export function resolveCodeBlockContentRange(
  editor: Editor,
  blockPos: number,
): CodeBlockContentRange | null {
  const block = codeBlockNodeAt(editor, blockPos)
  if (!block) return null
  const contentFrom = blockPos + 1
  const contentTo = blockPos + block.nodeSize - 1
  if (contentTo < contentFrom) return null
  return { blockPos, contentFrom, contentTo }
}

/** Whether a PM text patch is required for the given code block body. */
export function shouldPatchCodeBlockText(currentText: string, nextText: string): boolean {
  return normalizeCodeBlockText(currentText) !== normalizeCodeBlockText(nextText)
}

/**
 * Build a ProseMirror transaction that replaces code block body text.
 * Returns null when text is unchanged or block is missing.
 */
export function buildCodeBlockTextPatchTransaction(
  editor: Editor,
  blockPos: number,
  nextText: string,
  options?: { addToHistory?: boolean },
): Transaction | null {
  const range = resolveCodeBlockContentRange(editor, blockPos)
  if (!range) return null
  const block = codeBlockNodeAt(editor, blockPos)
  if (!block) return null
  const current = block.textBetween(0, block.content.size, '\n', '\n')
  const normalized = normalizeCodeBlockText(nextText)
  if (!shouldPatchCodeBlockText(current, normalized)) return null

  const patch = computeCodeBlockTextPatchRange(current, normalized)
  if (!patch) return null

  let tr = editor.state.tr
  const pmFrom = range.contentFrom + patch.from
  const pmTo = range.contentFrom + patch.to
  if (patch.insert.length === 0) {
    if (pmTo > pmFrom) tr = tr.delete(pmFrom, pmTo)
  } else if (pmFrom === pmTo) {
    tr = tr.insert(pmFrom, editor.schema.text(patch.insert))
  } else {
    tr = tr.replaceWith(pmFrom, pmTo, editor.schema.text(patch.insert))
  }
  tr = tr.setMeta(CODE_BLOCK_CM_ORIGIN_META, true)
  if (options?.addToHistory === false) {
    tr = tr.setMeta('addToHistory', false)
  }
  return tr
}

/** Apply code block body text from CM; no-op when unchanged. */
export function applyCodeBlockTextFromCm(
  editor: Editor,
  blockPos: number,
  nextText: string,
  options?: ApplyCodeBlockTextFromCmOptions,
): boolean {
  const tr = buildCodeBlockTextPatchTransaction(editor, blockPos, nextText, options)
  if (!tr) return false
  if (editor.isDestroyed) return false
  try {
    editor.view.dispatch(tr)
    return true
  } catch {
    return false
  }
}

/** Replace an empty code block with a paragraph (Backspace/Delete parity with fenceGuard). */
export function buildEmptyCodeBlockToParagraphTransaction(
  editor: Editor,
  blockPos: number,
): Transaction | null {
  const { state } = editor
  const block = state.doc.nodeAt(blockPos)
  if (!block || block.type.name !== 'codeBlock' || block.textContent.length > 0) return null
  const para = state.schema.nodes.paragraph
  if (!para) return null
  const $at = state.doc.resolve(blockPos)
  const parent = $at.node($at.depth)
  const index = $at.index($at.depth)
  if (!parent.canReplaceWith(index, index + 1, para)) return null
  const tr = state.tr.replaceWith(blockPos, blockPos + block.nodeSize, para.create())
  return tr.setSelection(TextSelection.create(tr.doc, blockPos + 1)).scrollIntoView()
}

export function replaceEmptyCodeBlockWithParagraph(editor: Editor, blockPos: number): boolean {
  const tr = buildEmptyCodeBlockToParagraphTransaction(editor, blockPos)
  if (!tr) return false
  editor.view.dispatch(tr)
  return true
}

export function readCodeBlockText(block: PmNode | null): string {
  if (!block || block.type.name !== 'codeBlock') return ''
  return block.textBetween(0, block.content.size, '\n', '\n')
}

/** Leading whitespace on the line before `offset` inside normalized text. */
export function leadingIndentForLineOffset(text: string, offset: number): string {
  const normalized = normalizeCodeBlockText(text)
  const clamped = Math.max(0, Math.min(offset, normalized.length))
  const before = normalized.slice(0, clamped)
  const lineStart = before.lastIndexOf('\n') + 1
  const linePrefix = before.slice(lineStart)
  return (linePrefix.match(/^[\t ]*/u) ?? [''])[0]
}

/** Expand tabs in a line prefix to spaces (fence Enter parity). */
export function expandIndentTabs(indent: string, tabSize = 4): string {
  return indent.replace(/\t/g, ' '.repeat(tabSize))
}

/** Insert newline + continued indent at CM cursor offset (fence Enter parity). */
export function insertNewlineWithIndent(text: string, offset: number, tabSize = 4): string {
  const normalized = normalizeCodeBlockText(text)
  const clamped = Math.max(0, Math.min(offset, normalized.length))
  const indent = expandIndentTabs(leadingIndentForLineOffset(normalized, clamped), tabSize)
  return `${normalized.slice(0, clamped)}\n${indent}${normalized.slice(clamped)}`
}
