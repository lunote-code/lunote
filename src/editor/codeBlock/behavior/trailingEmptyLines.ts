import { lineIndexFromCharOffset, normalizeCodeBlockText } from '../model/lineModel'

import type { Node as PmNode, Schema } from '@tiptap/pm/model'
import { Transform } from '@tiptap/pm/transform'

/** Max empty lines after the last non-empty row (EOF). Middle blank lines are untouched. */
export const MAX_CODE_BLOCK_TRAILING_EMPTY_LINES = 1

/**
 * Max stored `\n` count in an all-empty block while editing.
 * `0` => single display row (`""`); `1` => one blank row below (`"\n"`).
 */
export const MAX_ALL_EMPTY_BLOCK_NEWLINES = 1

export function splitCodeBlockLines(text: string): string[] {
  const normalized = normalizeCodeBlockText(text)
  return normalized.length === 0 ? [''] : normalized.split('\n')
}

export function countTrailingEmptyLines(text: string): number {
  const lines = splitCodeBlockLines(text)
  let trailing = 0
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if ((lines[i] ?? '').length > 0) break
    trailing += 1
  }
  return trailing
}

export function countNonEmptyLines(text: string): number {
  return splitCodeBlockLines(text).filter((line) => line.length > 0).length
}

function collapseTrailingEmptyRun(text: string, maxTrailingEmpty: number): string {
  const normalized = normalizeCodeBlockText(text)
  const lines = splitCodeBlockLines(normalized)
  const trailing = countTrailingEmptyLines(normalized)
  if (trailing <= maxTrailingEmpty) return normalized

  const contentEnd = lines.length - trailing
  const keptTrailing = Array.from({ length: maxTrailingEmpty }, () => '')
  return [...lines.slice(0, contentEnd), ...keptTrailing].join('\n')
}

/**
 * Aggressive collapse when opening/parsing markdown (repairs `\n` spam blocks).
 * All-newline bodies normalize to `""` (one display line).
 */
export function collapseCodeBlockTrailingEmptyLinesOnLoad(text: string): string {
  const normalized = normalizeCodeBlockText(text)
  const nonEmptyCount = countNonEmptyLines(normalized)

  if (nonEmptyCount === 0) {
    return normalized.includes('\n') ? '' : normalized
  }

  return collapseTrailingEmptyRun(normalized, MAX_CODE_BLOCK_TRAILING_EMPTY_LINES)
}

/** @deprecated Prefer `collapseCodeBlockTrailingEmptyLinesOnLoad`. */
export function collapseCodeBlockTrailingEmptyLines(text: string): string {
  return collapseCodeBlockTrailingEmptyLinesOnLoad(text)
}

/**
 * Conservative collapse during live editing — never undo a single user Enter.
 * Only trims once trailing empties exceed the allowed cap.
 */
export function collapseCodeBlockTrailingEmptyLinesOnEdit(text: string): string {
  const normalized = normalizeCodeBlockText(text)
  const nonEmptyCount = countNonEmptyLines(normalized)

  if (nonEmptyCount === 0) {
    const newlineCount = (normalized.match(/\n/g) ?? []).length
    if (newlineCount <= MAX_ALL_EMPTY_BLOCK_NEWLINES) return normalized
    return '\n'.repeat(MAX_ALL_EMPTY_BLOCK_NEWLINES)
  }

  return collapseTrailingEmptyRun(normalized, MAX_CODE_BLOCK_TRAILING_EMPTY_LINES)
}

/** Block Enter when it would grow an already-maximal trailing empty run at EOF. */
export function shouldRejectCodeBlockEnterNewline(text: string, cursorOffset: number): boolean {
  const normalized = normalizeCodeBlockText(text)
  const lines = splitCodeBlockLines(normalized)

  if (lines.every((line) => line.length === 0)) {
    return lines.length >= 2
  }

  const trailing = countTrailingEmptyLines(normalized)
  if (trailing === 0) return false

  const lineIndex0 = lineIndexFromCharOffset(normalized, cursorOffset) - 1
  const firstTrailingIndex = lines.length - trailing
  if (lineIndex0 < firstTrailingIndex) return false

  return trailing >= MAX_CODE_BLOCK_TRAILING_EMPTY_LINES
}

/** Collapse excessive trailing empty rows when loading or transforming a full document. */
export function normalizeCodeBlockTrailingEmptyLinesInDoc(doc: PmNode, schema: Schema): PmNode {
  const codeBlock = schema.nodes.codeBlock
  if (!codeBlock) return doc

  const fixes: { pos: number; from: number; to: number; text: string }[] = []
  doc.descendants((node, pos) => {
    if (node.type !== codeBlock) return
    const text = node.textBetween(0, node.content.size, '\n', '\n')
    const collapsed = collapseCodeBlockTrailingEmptyLinesOnLoad(text)
    if (collapsed === text) return
    fixes.push({
      pos,
      from: pos + 1,
      to: pos + node.nodeSize - 1,
      text: collapsed,
    })
  })

  if (fixes.length === 0) return doc

  fixes.sort((a, b) => b.pos - a.pos)
  let tr = new Transform(doc)
  for (const fix of fixes) {
    if (fix.text.length > 0) {
      tr = tr.replaceWith(fix.from, fix.to, schema.text(fix.text))
    } else {
      tr = tr.delete(fix.from, fix.to)
    }
  }
  return tr.doc
}
