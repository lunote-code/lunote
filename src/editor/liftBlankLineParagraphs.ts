import MarkdownIt from 'markdown-it'
import { Fragment } from 'prosemirror-model'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'

import { stripLeadingYamlFrontmatter } from './lunaMarkdownExtensionsPreprocess'

function fenceToggleLine(line: string): boolean {
  return /^\s*(?:`{3,}|~{3,})\s*[^\n]*$/u.test(line)
}

type BlockLineRange = {
  start: number
  end: number
  type: string
}

const blankLineLayoutMarkdownIt = MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
}).enable(['table', 'strikethrough'], true)

type BlankLineLayout = {
  leading: number
  gaps: number[]
  trailing: number
}

type GapNormalizationDebug = {
  original: number[]
  normalized: number[]
  removed: Array<{ index: number; value: number; reason: 'tail-zero' | 'tail-min' }>
  padded: number
}

function isBlankLineTraceEnabled(): boolean {
  return false
}

function tailPreview(text: string, size = 24): string {
  return JSON.stringify(text.slice(-size))
}

function formatBlankLineLayout(layout: BlankLineLayout): string {
  return `leading=${layout.leading} gaps=[${layout.gaps.join(',')}] trailing=${layout.trailing}`
}

function formatGapNormalizationDebug(debug: GapNormalizationDebug): string {
  const removed =
    debug.removed.length > 0
      ? debug.removed.map((item) => `${item.reason}@${item.index}=${item.value}`).join('|')
      : 'none'
  return `original=[${debug.original.join(',')}] normalized=[${debug.normalized.join(',')}] removed=${removed} padded=${debug.padded}`
}

function countInterBlockBlankLines(runLength: number): number {
  if (runLength <= 0) return 0
  /**
   * Typora/CommonMark semantics: one blank line between block nodes is purely
   * structural and should be expressed by block margin, not by a lifted empty
   * paragraph. Only the 2nd blank line and beyond become visible empty lines.
   */
  return Math.max(0, runLength - 1)
}

function extractTopLevelBlockRanges(body: string): BlockLineRange[] {
  const tokens = blankLineLayoutMarkdownIt.parse(body, {})
  const ranges: BlockLineRange[] = []
  for (const token of tokens) {
    if (!Array.isArray(token.map)) continue
    if (token.level !== 0) continue
    if (token.type === 'inline' || token.type.endsWith('_close')) continue
    const [start, end] = token.map
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    ranges.push({ start, end, type: token.type })
  }
  return ranges
}

function isListTopLevelOpenToken(type: string): boolean {
  return type === 'ordered_list_open' || type === 'bullet_list_open'
}

function trimTrailingBlankLinesFromLineEnd(body: string, startLine: number, endLine: number): number {
  const lines = body.split('\n')
  let end = endLine
  while (end > startLine) {
    const line = lines[end - 1] ?? ''
    if (line.trim().length > 0) break
    end -= 1
  }
  return end
}

/** markdown-it list tokens often swallow trailing blank lines; trim them for layout math. */
export function effectiveTopLevelBlockEndLine(
  body: string,
  range: Pick<BlockLineRange, 'start' | 'end' | 'type'>,
): number {
  if (!isListTopLevelOpenToken(range.type)) return range.end
  return trimTrailingBlankLinesFromLineEnd(body, range.start, range.end)
}

/**
 * Count intentional blank-line gaps in Markdown (outside fences).
 * Leading / between-block / trailing blank lines are all preserved.
 */
export function computeBlankLineLayout(markdown: string): BlankLineLayout {
  const { body } = stripLeadingYamlFrontmatter(markdown)
  const lines = body.split('\n')
  const topLevelRanges = extractTopLevelBlockRanges(body)
  const gaps: number[] = []
  const gapRuns: string[] = []
  let leading = 0
  let trailing = 0
  let inFence = false
  let emptyRun = 0
  let sawContent = false
  let lineIndex = 0
  let lastContentLine = -1

  /**
   * `split('\n')` always produces a final empty token when the source ends with
   * a normal trailing newline. In addition, a terminal `\n\n` after the last
   * block is treated by Markdown renderers like Typora as structural EOF
   * spacing, not as a visible blank paragraph. Only the 3rd trailing newline
   * and beyond should become intentional empty paragraphs in the visual doc.
   */
  const countTrailingBlankLines = (runLength: number): number => {
    if (runLength <= 0) return 0
    if (!body.endsWith('\n')) return runLength
    return Math.max(0, runLength - 2)
  }

  if (topLevelRanges.length > 0) {
    leading = Math.max(0, topLevelRanges[0]?.start ?? 0)
    for (let i = 1; i < topLevelRanges.length; i += 1) {
      const prev = topLevelRanges[i - 1]
      const next = topLevelRanges[i]
      const prevEnd = effectiveTopLevelBlockEndLine(body, prev)
      const rawRun = Math.max(0, next.start - prevEnd)
      const lifted = countInterBlockBlankLines(rawRun)
      gaps.push(lifted)
      gapRuns.push(`token@${prevEnd}->${next.start}:${prev.type}->${next.type},run=${rawRun},lift=${lifted}`)
    }
    const last = topLevelRanges[topLevelRanges.length - 1]
    const trailingRun = Math.max(0, lines.length - effectiveTopLevelBlockEndLine(body, last))
    trailing = countTrailingBlankLines(trailingRun)
    const layout = { leading, gaps, trailing }
    if (isBlankLineTraceEnabled()) {
      const trailingNewlineChars = body.length - body.replace(/\n+$/u, '').length
      const blockRanges = topLevelRanges.map((range) => `${range.type}[${range.start},${range.end})`).join('>')
      console.debug(
        `[BLANKLINE_LAYOUT] bodyLen=${body.length} lines=${lines.length} endsWithNl=${body.endsWith('\n') ? 1 : 0} trailingNlChars=${trailingNewlineChars} emptyRunAtEnd=${trailingRun} tail=${tailPreview(body)} ${formatBlankLineLayout(layout)} gapRuns=${gapRuns.join(' | ')} blockRanges=${blockRanges}`,
      )
    }
    return layout
  }

  const flushRunBeforeContent = () => {
    if (emptyRun <= 0) return
    if (!sawContent) leading += emptyRun
    else {
      const lifted = countInterBlockBlankLines(emptyRun)
      gaps.push(lifted)
      gapRuns.push(`raw@${lastContentLine}->${lineIndex}:run=${emptyRun},lift=${lifted}`)
    }
    emptyRun = 0
  }

  for (const line of lines) {
    if (fenceToggleLine(line)) {
      if (!inFence) {
        flushRunBeforeContent()
        sawContent = true
        lastContentLine = lineIndex
      } else {
        emptyRun = 0
      }
      inFence = !inFence
      lineIndex += 1
      continue
    }
    if (inFence) {
      lineIndex += 1
      continue
    }

    if (line.trim() === '') {
      emptyRun += 1
    } else {
      flushRunBeforeContent()
      sawContent = true
      lastContentLine = lineIndex
    }
    lineIndex += 1
  }

  if (emptyRun > 0) {
    if (!sawContent) leading += emptyRun
    else trailing = countTrailingBlankLines(emptyRun)
  }

  const layout = { leading, gaps, trailing }
  if (isBlankLineTraceEnabled()) {
    const trailingNewlineChars = body.length - body.replace(/\n+$/u, '').length
    console.debug(
      `[BLANKLINE_LAYOUT] bodyLen=${body.length} lines=${lines.length} endsWithNl=${body.endsWith('\n') ? 1 : 0} trailingNlChars=${trailingNewlineChars} emptyRunAtEnd=${emptyRun} tail=${tailPreview(body)} ${formatBlankLineLayout(layout)} gapRuns=${gapRuns.join(' | ')} blockRanges=fallback-line-scan`,
    )
  }
  return layout
}

/** Align gap array length with PM block boundaries (lists/fences may differ from raw line gaps). */
function normalizeGapCounts(gaps: number[], slotCount: number): GapNormalizationDebug {
  if (slotCount <= 0) {
    return { original: [...gaps], normalized: [], removed: [], padded: 0 }
  }
  if (gaps.length === slotCount) {
    return { original: [...gaps], normalized: [...gaps], removed: [], padded: 0 }
  }
  /**
   * `gaps` is line-driven and may contain extra zero-gaps produced inside
   * multi-line blocks (for example GFM tables / multi-line paragraphs).
   * Prefer dropping redundant zero-gaps from the tail to preserve early
   * alignment with real top-level PM blocks.
   */
  if (gaps.length > slotCount) {
    const next = [...gaps]
    const removed: GapNormalizationDebug['removed'] = []
    while (next.length > slotCount) {
      let removeAt = -1
      let reason: GapNormalizationDebug['removed'][number]['reason'] = 'tail-zero'
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i] === 0) {
          removeAt = i
          break
        }
      }
      if (removeAt < 0) {
        reason = 'tail-min'
        let min = Number.POSITIVE_INFINITY
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i] <= min) {
            min = next[i]
            removeAt = i
          }
        }
      }
      removed.push({ index: removeAt, value: next[removeAt] ?? 0, reason })
      next.splice(removeAt, 1)
    }
    return { original: [...gaps], normalized: next, removed, padded: 0 }
  }
  return {
    original: [...gaps],
    normalized: [...gaps, ...Array(slotCount - gaps.length).fill(0)],
    removed: [],
    padded: slotCount - gaps.length,
  }
}

/** Trailing visually empty paragraphs (including hard-break-only stubs). */
export function countTrailingEmptyParagraphs(doc: ProseMirrorNode): number {
  let n = 0
  for (let i = doc.childCount - 1; i >= 0; i--) {
    const ch = doc.child(i)
    const visuallyEmpty =
      ch.type.name === 'paragraph' &&
      (ch.content.size === 0 ||
        (ch.childCount === 1 && ch.firstChild?.type.name === 'hardBreak'))
    if (!visuallyEmpty) break
    n++
  }
  return n
}

/**
 * prosemirror-markdown emits one fewer trailing newline than `computeBlankLineLayout`
 * expects for lifted empty paragraphs; pad so parse→lift round-trips stay stable.
 */
export function alignSerializedTrailingBlankLines(
  markdown: string,
  trailingEmptyParagraphCount: number,
): string {
  if (trailingEmptyParagraphCount <= 0) return markdown
  let result = markdown
  let guard = 0
  while (
    computeBlankLineLayout(result).trailing < trailingEmptyParagraphCount &&
    guard < trailingEmptyParagraphCount + 8
  ) {
    result += '\n'
    guard += 1
  }
  return result
}

/** Re-insert empty paragraph nodes lost by CommonMark parsing after tab reload / open. */
export function liftBlankLineParagraphs(
  doc: ProseMirrorNode,
  schema: Schema,
  markdown: string,
): ProseMirrorNode {
  const layout = computeBlankLineLayout(markdown)
  const gapSlots = doc.childCount - 1
  const normalization = normalizeGapCounts(layout.gaps, gapSlots)
  const normalizedGaps = normalization.normalized
  if (isBlankLineTraceEnabled()) {
    const pmTypes = Array.from({ length: doc.childCount }, (_, i) => doc.child(i).type.name).join('>')
    const slotMap =
      gapSlots > 0
        ? Array.from({ length: gapSlots }, (_, i) => {
            const prevType = doc.child(i).type.name
            const nextType = doc.child(i + 1).type.name
            const rawGap = layout.gaps[i]
            const normalizedGap = normalizedGaps[i] ?? 0
            return `#${i}:${prevType}->${nextType}{raw=${rawGap ?? 'na'},norm=${normalizedGap},insert=${normalizedGap}}`
          }).join(' | ')
        : 'none'
    console.debug(
      `[BLANKLINE_LIFT] docChildren=${doc.childCount} gapSlots=${gapSlots} lastType=${doc.lastChild?.type.name ?? 'null'} lastEmpty=${
        doc.lastChild?.type.name === 'paragraph' && doc.lastChild.content.size === 0 ? 1 : 0
      } ${formatBlankLineLayout(layout)} ${formatGapNormalizationDebug(normalization)} pmTypes=${pmTypes} slotMap=${slotMap}`,
    )
  }
  if (
    layout.leading === 0 &&
    layout.trailing === 0 &&
    layout.gaps.every((g) => g === 0)
  ) {
    return doc
  }

  const para = schema.nodes.paragraph
  const docType = schema.nodes.doc
  if (!para || !docType || doc.childCount < 1) return doc

  const children: ProseMirrorNode[] = []

  for (let e = 0; e < layout.leading; e++) {
    children.push(para.create())
  }

  for (let i = 0; i < doc.childCount; i++) {
    if (i > 0) {
      const extras = normalizedGaps[i - 1] ?? 0
      for (let e = 0; e < extras; e++) {
        children.push(para.create())
      }
    }
    children.push(doc.child(i))
  }

  for (let e = 0; e < layout.trailing; e++) {
    children.push(para.create())
  }

  return docType.create(null, Fragment.from(children))
}
