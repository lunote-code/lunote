import { ChangeSet, type ChangeSpec, type Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { indentUnit } from '@codemirror/language'

import {
  SOURCE_MARKDOWN_TAB_SPACES,
  isMarkdownFenceDelimiterLine,
  isMarkdownListLine,
  isMarkdownTableRowLine,
  sourceCursorInCodeFence,
} from './sourceMarkdownTabContext'

export { SOURCE_MARKDOWN_TAB_SPACES } from './sourceMarkdownTabContext'

export const sourceMarkdownIndentUnit = indentUnit.of(SOURCE_MARKDOWN_TAB_SPACES)

type LineRef = { from: number; to: number; number: number; text: string }

function collectLinesInSelection(doc: Text, ranges: readonly { from: number; to: number }[]): LineRef[] {
  const seen = new Set<number>()
  const lines: LineRef[] = []
  for (const range of ranges) {
    const fromLine = doc.lineAt(range.from).number
    const toLine = doc.lineAt(range.to).number
    for (let n = fromLine; n <= toLine; n += 1) {
      if (seen.has(n)) continue
      seen.add(n)
      const line = doc.line(n)
      lines.push({ from: line.from, to: line.to, number: n, text: line.text })
    }
  }
  return lines.sort((a, b) => a.from - b.from)
}

function dispatchChangeSet(
  view: EditorView,
  specs: ChangeSpec[],
  userEvent: 'input.indent' | 'delete.dedent',
): boolean {
  if (specs.length === 0) return false
  const changeSet = ChangeSet.of(specs, view.state.doc.length)
  view.dispatch({
    changes: changeSet,
    selection: view.state.selection.map(changeSet),
    scrollIntoView: true,
    userEvent,
  })
  return true
}

function insertSpacesAtCursor(view: EditorView, from: number, to: number): boolean {
  return dispatchChangeSet(
    view,
    [{ from, to, insert: SOURCE_MARKDOWN_TAB_SPACES }],
    'input.indent',
  )
}

function indentLinesAtStart(view: EditorView, lines: LineRef[]): boolean {
  if (lines.length === 0) return false
  const specs = lines.map((line) => ({
    from: line.from,
    insert: SOURCE_MARKDOWN_TAB_SPACES,
  }))
  return dispatchChangeSet(view, specs, 'input.indent')
}

function outdentLinesAtStart(view: EditorView, lines: LineRef[]): boolean {
  const specs: ChangeSpec[] = []
  for (const line of lines) {
    const leading = line.text.match(/^ */u)?.[0] ?? ''
    const remove = Math.min(leading.length, SOURCE_MARKDOWN_TAB_SPACES.length)
    if (remove > 0) specs.push({ from: line.from, to: line.from + remove })
  }
  return dispatchChangeSet(view, specs, 'delete.dedent')
}

function indentCodeFenceSelection(view: EditorView): boolean {
  const { state } = view
  const main = state.selection.main
  if (main.empty) {
    return insertSpacesAtCursor(view, main.from, main.to)
  }
  const lines = collectLinesInSelection(state.doc, [main])
  return indentLinesAtStart(view, lines)
}

function outdentCodeFenceSelection(view: EditorView): boolean {
  const { state } = view
  const lines = collectLinesInSelection(state.doc, state.selection.ranges)
  return outdentLinesAtStart(view, lines)
}

function classifyTabKind(
  doc: string,
  pos: number,
  lineText: string,
): 'codeFence' | 'list' | 'table' | 'plain' | 'skip' {
  if (isMarkdownFenceDelimiterLine(lineText)) return 'skip'
  if (sourceCursorInCodeFence(doc, pos)) return 'codeFence'
  if (isMarkdownListLine(lineText)) return 'list'
  if (isMarkdownTableRowLine(lineText)) return 'table'
  return 'plain'
}

/**
 * Source Tab — align with visual `LunaTabInText` / `LunaCodeFenceGuard`:
 * list: +4 spaces at line start; plain/table: +4 spaces at cursor; fence body: code indent.
 */
export function runSourceMarkdownTab(view: EditorView): boolean {
  if (view.state.readOnly) return false
  const { state } = view
  const doc = state.doc.toString()
  const main = state.selection.main
  const line = state.doc.lineAt(main.from)
  const kind = classifyTabKind(doc, main.from, line.text)

  if (kind === 'skip') return false
  if (kind === 'codeFence') return indentCodeFenceSelection(view)
  if (kind === 'list') {
    const lines = collectLinesInSelection(state.doc, state.selection.ranges)
    return indentLinesAtStart(view, lines)
  }
  return insertSpacesAtCursor(view, main.from, main.to)
}

/**
 * Source Shift-Tab — align with visual list lift + code fence outdent; plain paragraphs: no-op.
 */
export function runSourceMarkdownShiftTab(view: EditorView): boolean {
  if (view.state.readOnly) return false
  const { state } = view
  const doc = state.doc.toString()
  const main = state.selection.main
  const line = state.doc.lineAt(main.from)
  const kind = classifyTabKind(doc, main.from, line.text)

  if (kind === 'skip') return false
  if (kind === 'codeFence') return outdentCodeFenceSelection(view)
  if (kind === 'list') {
    const lines = collectLinesInSelection(state.doc, state.selection.ranges)
    return outdentLinesAtStart(view, lines)
  }
  return false
}
