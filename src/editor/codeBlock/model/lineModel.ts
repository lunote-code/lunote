import type { Node as PmNode } from '@tiptap/pm/model'
import { normalizeLineEndings } from '../../../lib/normalizeLineEndings'

/** Normalized code block body text (PM `textBetween` shape). */
export function normalizeCodeBlockText(text: string): string {
  return normalizeLineEndings(text ?? '')
}

/** Document line count — matches contenteditable `white-space: pre` (one row per `\n`). */
export function countDocumentLinesFromText(text: string): number {
  const normalized = normalizeCodeBlockText(text)
  if (normalized.length === 0) return 1
  return Math.max(normalized.split('\n').length, 1)
}

/** @deprecated Prefer `countDocumentLinesFromText`; kept for existing imports. */
export function countCodeBlockLogicalLinesFromText(text: string): number {
  return countDocumentLinesFromText(text)
}

export function countCodeBlockLogicalLines(node: PmNode): number {
  const text = node.textBetween(0, node.content.size, '\n', '\n')
  return countDocumentLinesFromText(text)
}

/** Gutter row count follows document text; caret cannot outrun stored newlines. */
export function codeBlockGutterLineCount(
  nodeLineCount: number,
  caretLine?: number | null,
): number {
  return Math.max(nodeLineCount, caretLine ?? 0, 1)
}

/** Char offsets for each 1-based logical line start inside normalized text. */
export function computeLineStarts(text: string): number[] {
  const normalized = normalizeCodeBlockText(text)
  if (normalized.length === 0) return [0]

  const starts = [0]
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] === '\n') starts.push(i + 1)
  }
  return starts
}

export type CodeBlockLineModel = {
  text: string
  documentLineCount: number
  displayLineCount: number
  lineStarts: number[]
}

/** Single source of truth for code block line semantics (Phase 1+). */
export function buildCodeBlockLineModel(text: string): CodeBlockLineModel {
  const normalized = normalizeCodeBlockText(text)
  const documentLineCount = countDocumentLinesFromText(normalized)
  return {
    text: normalized,
    documentLineCount,
    displayLineCount: documentLineCount,
    lineStarts: computeLineStarts(normalized),
  }
}

/** 1-based line index for a char offset inside normalized text. */
export function lineIndexFromCharOffset(text: string, offset: number): number {
  const normalized = normalizeCodeBlockText(text)
  const clamped = Math.max(0, Math.min(offset, normalized.length))
  if (normalized.length === 0) return 1
  let line = 1
  for (let i = 0; i < clamped; i += 1) {
    if (normalized[i] === '\n') line += 1
  }
  return Math.max(1, line)
}

/** @deprecated Alias of `lineIndexFromCharOffset` — kept for existing imports. */
export function lineIndexFromVisibleCharOffset(text: string, offset: number): number {
  return lineIndexFromCharOffset(text, offset)
}
