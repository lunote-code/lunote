import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import { isAtLastNonEmptyCodeLineEnd } from '../behavior/trailingEmptyLines'
import { removeOneIndentLevel } from '../behavior/indent'
import { insertNewlineWithIndent } from './codeBlockCmSync'

const DEFAULT_TAB_SIZE = 4

/** Insert `tabSize` spaces at offset (fence Tab parity for empty selection). */
export function insertSpacesAtOffset(text: string, offset: number, tabSize = DEFAULT_TAB_SIZE): string {
  const clamped = Math.max(0, Math.min(offset, text.length))
  const spaces = ' '.repeat(tabSize)
  return `${text.slice(0, clamped)}${spaces}${text.slice(clamped)}`
}

/** Prefix each selected line with `tabSize` spaces. */
export function indentSelectedLines(text: string, from: number, to: number, tabSize = DEFAULT_TAB_SIZE): {
  next: string
  selectionFrom: number
  selectionTo: number
} {
  const spaces = ' '.repeat(tabSize)
  const slice = text.slice(from, to)
  const indented = slice
    .split('\n')
    .map((line) => `${spaces}${line}`)
    .join('\n')
  const next = `${text.slice(0, from)}${indented}${text.slice(to)}`
  return {
    next,
    selectionFrom: from,
    selectionTo: from + indented.length,
  }
}

/** Unindent each selected line by one tab stop. */
export function outdentSelectedLines(text: string, from: number, to: number, tabSize = DEFAULT_TAB_SIZE): {
  next: string
  selectionFrom: number
  selectionTo: number
} {
  const slice = text.slice(from, to)
  const outdented = slice
    .split('\n')
    .map((line) => removeOneIndentLevel(line, tabSize).text)
    .join('\n')
  const next = `${text.slice(0, from)}${outdented}${text.slice(to)}`
  return {
    next,
    selectionFrom: from,
    selectionTo: from + outdented.length,
  }
}

/** Remove one indent level from the line containing `offset` when selection is empty. */
export function outdentLineAtOffset(
  text: string,
  offset: number,
  tabSize = DEFAULT_TAB_SIZE,
): { next: string; cursor: number } | null {
  const clamped = Math.max(0, Math.min(offset, text.length))
  const lineStart = text.lastIndexOf('\n', clamped - 1) + 1
  const lineEnd = text.indexOf('\n', clamped)
  const lineEndPos = lineEnd === -1 ? text.length : lineEnd
  const line = text.slice(lineStart, lineEndPos)
  const { text: stripped, removed } = removeOneIndentLevel(line, tabSize)
  if (removed === 0) return null
  const next = `${text.slice(0, lineStart)}${stripped}${text.slice(lineEndPos)}`
  const cursorInLine = clamped - lineStart
  const cursor = lineStart + Math.max(0, cursorInLine - removed)
  return { next, cursor }
}

export function runCodeBlockCmEnter(view: EditorView, tabSize = DEFAULT_TAB_SIZE): boolean {
  const { state } = view
  if (!state.selection.main.empty) return false
  const offset = state.selection.main.from
  const text = state.doc.toString()
  const after = insertNewlineWithIndent(text, offset, tabSize)
  const insert = after.slice(offset, offset + (after.length - text.length))
  if (!insert) return false
  view.dispatch({
    changes: { from: offset, to: offset, insert },
    selection: { anchor: offset + insert.length },
  })
  return true
}

export function runCodeBlockCmTab(view: EditorView, tabSize = DEFAULT_TAB_SIZE): boolean {
  const { state } = view
  const { from, to, empty } = state.selection.main
  const text = state.doc.toString()
  if (empty) {
    const next = insertSpacesAtOffset(text, from, tabSize)
    const insert = next.slice(from, from + tabSize)
    view.dispatch({
      changes: { from, to: from, insert },
      selection: { anchor: from + insert.length },
    })
    return true
  }
  const { next, selectionFrom, selectionTo } = indentSelectedLines(text, from, to, tabSize)
  view.dispatch({
    changes: { from: 0, to: text.length, insert: next },
    selection: { anchor: selectionFrom, head: selectionTo },
  })
  return true
}

export function runCodeBlockCmShiftTab(view: EditorView, tabSize = DEFAULT_TAB_SIZE): boolean {
  const { state } = view
  const { from, to, empty } = state.selection.main
  const text = state.doc.toString()
  if (empty) {
    const out = outdentLineAtOffset(text, from, tabSize)
    if (!out) return true
    view.dispatch({
      changes: { from: 0, to: text.length, insert: out.next },
      selection: { anchor: out.cursor },
    })
    return true
  }
  const { next, selectionFrom, selectionTo } = outdentSelectedLines(text, from, to, tabSize)
  view.dispatch({
    changes: { from: 0, to: text.length, insert: next },
    selection: { anchor: selectionFrom, head: selectionTo },
  })
  return true
}

export function runCodeBlockCmBackspaceOnEmpty(view: EditorView, onDeleteEmptyBlock?: () => boolean): boolean {
  const text = view.state.doc.toString()
  if (text.length > 0) return false
  return onDeleteEmptyBlock?.() ?? false
}

/** CM caret is on the last document line (↓ should focus language chip). */
export function shouldCodeBlockCmBoundaryDown(state: EditorState): boolean {
  const head = state.selection.main.head
  return isAtLastNonEmptyCodeLineEnd(state.doc.toString(), head)
}

/** CM caret is on the first document line (↑ should focus language chip). */
export function shouldCodeBlockCmBoundaryUp(state: EditorState): boolean {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  return line.number === 1
}
