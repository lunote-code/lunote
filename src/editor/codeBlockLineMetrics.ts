/** Measures the actual pixel height of each logical line within a visual mode code block (consistent with ProseMirror rendering)*/

import type { Node as PmNode } from '@tiptap/pm/model'

/** Consistent with PM `textBetween`: keep the blank line corresponding to the trailing `\n`*/
export function countCodeBlockLogicalLinesFromText(text: string): number {
  const normalized = (text ?? '').replace(/\r\n/g, '\n')
  if (normalized.length === 0) return 1
  /**
   * Align with <pre> visual behavior:
   * A single newline at the end usually does not form an additional visible line on rendering (resulting in "one more line number").
   */
  const visualText = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
  if (visualText.length === 0) return 1
  return visualText.split('\n').length
}

export function countCodeBlockLogicalLines(node: PmNode): number {
  const text = node.textBetween(0, node.content.size, '\n', '\n')
  return countCodeBlockLogicalLinesFromText(text)
}

/**
 * The number of lines that the line number column should display: the document count and the current cursor line, whichever is greater.
 * When there is only `\n` at the end and the cursor is on a blank line, `caretLineInCodeBlock` will be 1 more than `countCodeBlockLogicalLines`.
 */
export function codeBlockGutterLineCount(nodeLineCount: number, caretLine: number | null | undefined): number {
  return Math.max(nodeLineCount, caretLine ?? 0, 1)
}

/** ProseMirror contentDOM (preferred) or TipTap React wrapping layer*/
export function resolveCodeBlockContentRoot(surface: HTMLElement | null): HTMLElement | null {
  if (!surface) return null
  return (
    (surface.querySelector('[data-node-view-content-react]') as HTMLElement | null) ??
    (surface.querySelector('.pm-code-block-content [data-node-view-content-react]') as HTMLElement | null) ??
    (surface.querySelector('.pm-code-block-content [data-node-view-content]') as HTMLElement | null) ??
    (surface.querySelector('.pm-code-block-content') as HTMLElement | null)
  )
}

/** Get the top offset of the real visual row (px, relative to the top of the contentRoot)*/
export function measureCodeBlockVisualLineTops(root: HTMLElement): number[] {
  const range = document.createRange()
  range.selectNodeContents(root)
  const rects = Array.from(range.getClientRects())
  if (rects.length === 0) return [0]
  const rootTop = root.getBoundingClientRect().top
  const tops: number[] = []
  for (const rect of rects) {
    if (rect.height < 0.5 && rect.width < 0.5) continue
    const raw = rect.top - rootTop
    const t = Math.round(raw * 2) / 2
    const last = tops[tops.length - 1]
    if (last == null || Math.abs(t - last) > 0.5) {
      tops.push(t)
    }
  }
  return tops.length > 0 ? tops : [0]
}

/** Parse computed line-height (support px and unitless multiples to avoid reading 1.62 as pixels on Windows)*/
export function defaultLineHeightPx(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  const fs = parseFloat(cs.fontSize) || 14
  const raw = cs.lineHeight
  if (!raw || raw === 'normal') return fs * 1.62
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fs * 1.62
  if (raw.endsWith('px')) return parsed
  if (parsed > 4) return parsed
  return parsed * fs
}

/** The upper limit of single line measurement height: prevent empty lines/line breaks from measuring huge height across lines under WebView2*/
function clampMeasuredLineHeight(h: number, fallback: number): number {
  const max = fallback * 2.25
  if (h < fallback * 0.45) return fallback
  if (h > max) return fallback
  return h
}

function collectTextSegments(root: HTMLElement): { node: Text; start: number }[] {
  const segments: { node: Text; start: number }[] = []
  let pos = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n = walker.nextNode()
  while (n) {
    const text = n as Text
    segments.push({ node: text, start: pos })
    pos += text.data.length
    n = walker.nextNode()
  }
  return segments
}

function setRangeCharOffset(
  segments: { node: Text; start: number }[],
  range: Range,
  offset: number,
): boolean {
  if (segments.length === 0) return false
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const nextStart = segments[i + 1]?.start ?? Number.POSITIVE_INFINITY
    if (offset < seg.start || offset >= nextStart) continue
    const local = Math.min(offset - seg.start, seg.node.data.length)
    range.setStart(seg.node, local)
    range.setEnd(seg.node, local)
    return true
  }
  const last = segments[segments.length - 1]!
  const end = last.node.data.length
  range.setStart(last.node, end)
  range.setEnd(last.node, end)
  return true
}

/**
 * Measure the height by innerText logical lines: Use the top differences of adjacent lines to accumulate to avoid line-by-line rounding drift in long documents.
 */
export function measureCodeBlockLineHeights(root: HTMLElement): number[] {
  const raw = (root.textContent ?? '').replace(/\r\n/g, '\n')
  const lines = raw.split('\n')
  if (lines.length === 0) return [defaultLineHeightPx(root)]

  const segments = collectTextSegments(root)
  const range = document.createRange()
  const fallback = defaultLineHeightPx(root)
  const rootTop = root.getBoundingClientRect().top
  const relTops: Array<number | null> = []
  let charOffset = 0

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx] ?? ''
    const lineStart = charOffset
    if (segments.length > 0 && setRangeCharOffset(segments, range, lineStart)) {
      relTops.push(range.getBoundingClientRect().top - rootTop)
    } else {
      relTops.push(null)
    }
    charOffset += lineText.length + 1
  }

  const heights: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i] ?? ''
    const top = relTops[i]
    const nextTop = i < lines.length - 1 ? relTops[i + 1] : null

    //Empty rows: Use only standard row heights. Using "next line top difference" under Windows/WebView2 will cause a huge gap in the middle empty line.
    if (lineText.length === 0) {
      heights.push(fallback)
      continue
    }

    if (top != null && nextTop != null) {
      const gap = nextTop - top
      heights.push(clampMeasuredLineHeight(Math.max(1, gap), fallback))
      continue
    }

    if (top != null && i === lines.length - 1) {
      let lineStartOffset = 0
      for (let j = 0; j < i; j++) lineStartOffset += (lines[j] ?? '').length + 1
      const lastChar = lineStartOffset + Math.max(0, lineText.length - 1)
      let h = fallback
      if (lineText.length > 0 && setRangeCharOffset(segments, range, lastChar)) {
        h = Math.max(1, range.getBoundingClientRect().bottom - rootTop - top)
      }
      heights.push(clampMeasuredLineHeight(h, fallback))
      continue
    }

    heights.push(fallback)
  }

  return heights
}

/** Align the number of line numbers with the measurement results to avoid a newline at the end that is only visible to the DOM but has a count of 1*/
export function reconcileCodeBlockLineHeights(
  nodeLineCount: number,
  heights: number[],
  fallbackPx: number,
): number[] {
  const target = Math.max(nodeLineCount, 1)
  const out = heights.slice(0, target)
  while (out.length < target) out.push(fallbackPx)
  return out.map((h, i) => {
    if (h < fallbackPx * 0.5) return fallbackPx
    if (i === out.length - 1 && h < fallbackPx * 0.75) return fallbackPx
    return h
  })
}

/** The padding-top increment (px) required to align the first line of the line number column with the first line of the text*/
export function measureCodeBlockGutterPadDelta(
  linenosEl: HTMLElement,
  contentRoot: HTMLElement,
): number {
  const segments = collectTextSegments(contentRoot)
  if (segments.length === 0) return 0
  const range = document.createRange()
  if (!setRangeCharOffset(segments, range, 0)) return 0
  const contentTop = range.getBoundingClientRect().top

  const firstLineno = linenosEl.querySelector('.pm-code-lineno') as HTMLElement | null
  if (!firstLineno) return 0
  const linenoTop = firstLineno.getBoundingClientRect().top
  const delta = contentTop - linenoTop
  return Math.abs(delta) < 0.5 ? 0 : delta
}
