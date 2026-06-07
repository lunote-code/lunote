import type { Mark, Node as PMNode } from 'prosemirror-model'

import type { SemanticSliceKind } from './modeSwitchStructuralIRTypes'
import {
  type MdSemTok,
  mergeAdjacentMdTokens,
  mergeAdjacentPmTokens,
  type PmSemTok,
} from './modeSwitchSemanticZip'

export function structuredLineBodyMinIndexInSeg(
  seg: string,
  options?: { stripTaskMarkers?: boolean; includeCalloutMarker?: boolean },
): number {
  let i = skipListOrBlockquoteLinePrefix(seg, 0, { stripTaskMarkers: options?.stripTaskMarkers })
  if (options?.includeCalloutMarker) {
    const match = seg.slice(i).match(/^\[![^\]]+\]\s*/u)
    i += match?.[0]?.length ?? 0
  }
  return i
}

export function headingBodyMinIndexForLevel(seg: string, level: number): number {
  let i = structuredLineBodyMinIndexInSeg(seg, { stripTaskMarkers: false })
  let hashes = 0
  const clampedLevel = Math.min(6, Math.max(1, Number(level) || 1))
  while (i < seg.length && seg[i] === '#' && hashes < clampedLevel) {
    hashes += 1
    i += 1
  }
  while (i < seg.length && (seg[i] === ' ' || seg[i] === '\t')) i += 1
  return i
}

export function headingBodyMinIndexInSeg(seg: string, node: PMNode): number {
  if (node.type.name !== 'heading') return 0
  return headingBodyMinIndexForLevel(seg, Number((node.attrs as { level?: number }).level) || 1)
}

export function footnoteBodyMinIndexInSeg(seg: string): number {
  const match = seg.match(/^\[\^[^\]\s][^\]]*\]:\s?/u)
  return match?.[0]?.length ?? 0
}

export function syntaxAwareMinIndexInSeg(
  seg: string,
  node: PMNode,
  options?: { stripTaskMarkers?: boolean },
): number {
  const typeName = node.type.name
  const stripTaskMarkers = options?.stripTaskMarkers ?? false
  if (typeName === 'heading') return headingBodyMinIndexInSeg(seg, node)
  if (typeName === 'footnoteDef') return footnoteBodyMinIndexInSeg(seg)
  return structuredLineBodyMinIndexInSeg(seg, {
    stripTaskMarkers,
    includeCalloutMarker: true,
  })
}

function countBackslashesBefore(s: string, i: number): number {
  let count = 0
  for (let k = i - 1; k >= 0 && s[k] === '\\'; k -= 1) count += 1
  return count
}

function isActiveMdEscape(s: string, i: number): boolean {
  return countBackslashesBefore(s, i) % 2 === 1
}

function pmSliceKindFromMarks(marks: readonly Mark[]): SemanticSliceKind {
  for (const mark of marks) {
    if (mark.type.name === 'link') return 'link'
  }
  for (const mark of marks) {
    if (mark.type.name === 'bold') return 'strong'
  }
  for (const mark of marks) {
    if (mark.type.name === 'italic') return 'em'
  }
  for (const mark of marks) {
    if (mark.type.name === 'code') return 'code'
  }
  for (const mark of marks) {
    if (mark.type.name === 'strike') return 'strike'
  }
  for (const mark of marks) {
    if (mark.type.name === 'superscript') return 'sup'
  }
  for (const mark of marks) {
    if (mark.type.name === 'subscript') return 'sub'
  }
  for (const mark of marks) {
    if (mark.type.name === 'textColor') return 'html'
  }
  for (const mark of marks) {
    if (mark.type.name === 'underline') return 'html'
  }
  return 'text'
}

function injectSyntheticPmGapTokensFromFullText(
  toks: readonly PmSemTok[],
  fullText: string,
  pmInnerStart: number,
): PmSemTok[] {
  if (!toks.length || !fullText.length) return [...toks]
  const out: PmSemTok[] = []
  let cursor = 0
  for (let i = 0; i < toks.length; i += 1) {
    const token = toks[i]!
    const at = fullText.indexOf(token.text, cursor)
    if (at < 0) return [...toks]
    const gapText = fullText.slice(cursor, at)
    if (gapText.length > 0) {
      const prevPmEnd =
        out.length > 0
          ? out[out.length - 1]!.pmToExclusive
          : Math.max(pmInnerStart, token.pmFrom - gapText.length)
      if (token.pmFrom - prevPmEnd < gapText.length) return [...toks]
      out.push({
        text: gapText,
        kind: 'text',
        pmFrom: prevPmEnd,
        pmToExclusive: prevPmEnd + gapText.length,
      })
    }
    out.push({ ...token })
    cursor = at + token.text.length
  }
  return out
}

export function shouldSkipLinePrefixesForNode(node: PMNode): boolean {
  const typeName = node.type.name
  return (
    typeName === 'blockquote' ||
    typeName === 'bulletList' ||
    typeName === 'orderedList' ||
    typeName === 'taskList' ||
    typeName === 'taskItem'
  )
}

export function collectPmSemanticTokens(block: PMNode, pmInnerStart: number): PmSemTok[] | null {
  const out: PmSemTok[] = []
  try {
    block.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text ?? ''
        if (!text.length) return false
        const kind = pmSliceKindFromMarks(node.marks)
        const pmFrom = pmInnerStart + pos
        out.push({ text, kind, pmFrom, pmToExclusive: pmFrom + text.length })
        return false
      }
      if (node.type.name === 'hardBreak') {
        const pmFrom = pmInnerStart + pos
        out.push({ text: '\n', kind: 'text', pmFrom, pmToExclusive: pmFrom + 1 })
        return false
      }
      if (node.type.name === 'image') {
        const alt = String((node.attrs as { alt?: string })?.alt ?? '')
        const pmFrom = pmInnerStart + pos
        out.push({ text: alt, kind: 'image', pmFrom, pmToExclusive: pmFrom + alt.length })
        return false
      }
      if (node.type.name === 'rawInline') {
        const raw = String((node.attrs as { content?: string })?.content ?? '')
        const source = String((node.attrs as { source?: string })?.source ?? 'html')
        const pmFrom = pmInnerStart + pos
        const kind: SemanticSliceKind = source === 'html' ? 'html' : 'text'
        out.push({ text: raw, kind, pmFrom, pmToExclusive: pmFrom + raw.length })
        return false
      }
      if (node.type.name === 'inlineMath') {
        const latex = String((node.attrs as { latex?: string })?.latex ?? '')
        const pmFrom = pmInnerStart + pos
        out.push({ text: latex, kind: 'text', pmFrom, pmToExclusive: pmFrom + latex.length })
        return false
      }
      if (node.type.name === 'emoji') {
        const value = String((node.attrs as { value?: string })?.value ?? '').trim()
        if (!value.length) return false
        const pmFrom = pmInnerStart + pos
        out.push({ text: `:${value}:`, kind: 'text', pmFrom, pmToExclusive: pmFrom + value.length + 2 })
        return false
      }
      if (node.type.name === 'footnoteRef') {
        const label = String((node.attrs as { label?: string })?.label ?? '').trim()
        if (!label.length) return false
        const raw = `[^${label}]`
        const pmFrom = pmInnerStart + pos
        out.push({ text: raw, kind: 'text', pmFrom, pmToExclusive: pmFrom + raw.length })
        return false
      }
      return true
    })
  } catch {
    return null
  }
  if (shouldSkipLinePrefixesForNode(block) && out.length > 0) {
    const fullText = block.textBetween(0, block.content.size, '\n', '\n')
    return injectSyntheticPmGapTokensFromFullText(out, fullText, pmInnerStart)
  }
  return mergeAdjacentPmTokens(out)
}

function pushPlainTokenWithKind(
  out: MdSemTok[],
  s: string,
  from: number,
  to: number,
  baseAbs: number,
  kind: SemanticSliceKind,
) {
  if (from >= to) return
  const text = s.slice(from, to)
  out.push({
    text,
    kind,
    markdownFrom: baseAbs + from,
    markdownTo: baseAbs + to,
  })
}

function mdInlineSpecialWouldStart(s: string, j: number, n: number): boolean {
  if (j >= n) return false
  if (s[j] === '<' && !isActiveMdEscape(s, j)) {
    if (s.slice(j, j + 4) === '<!--') return true
    return /^<\/?[a-zA-Z]/.test(s.slice(j, j + 3))
  }
  if (s[j] === '`' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '[' && !isActiveMdEscape(s, j)) {
    if ((j + 1 < n && s[j + 1] === '[') || (j > 0 && s[j - 1] === '[')) return false
    return true
  }
  if (s[j] === '!' && j + 1 < n && s[j + 1] === '[' && !isActiveMdEscape(s, j)) {
    if (j + 2 < n && s[j + 2] === '[') return false
    return true
  }
  if (s[j] === '~' && j + 1 < n && s[j + 1] === '~' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '=' && j + 1 < n && s[j + 1] === '=' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '$' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '^' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '~' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '*' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '_' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '\\' && j + 1 < n && !isActiveMdEscape(s, j)) return true
  return false
}

export function skipListOrBlockquoteLinePrefix(
  s: string,
  i: number,
  options?: { stripTaskMarkers?: boolean },
): number {
  const stripTaskMarkers = options?.stripTaskMarkers ?? true
  let k = i
  let advanced = false

  for (;;) {
    let step = false

    for (;;) {
      let q = k
      while (q < s.length && (s[q] === ' ' || s[q] === '\t')) q += 1
      if (q < s.length && s[q] === '>') {
        q += 1
        while (q < s.length && (s[q] === ' ' || s[q] === '\t')) q += 1
        k = q
        step = true
        advanced = true
        continue
      }
      break
    }

    const rest = s.slice(k)
    const defDesc = rest.match(/^\s*:\s+/u)
    if (defDesc?.[0]) {
      k += defDesc[0].length
      step = true
      advanced = true
    }

    if (step) continue

    const task = stripTaskMarkers ? rest.match(/^\s*[-*+]\s+\[[ xX]\]\s+/) : null
    if (task?.[0]) {
      k += task[0].length
      step = true
      advanced = true
    } else {
      const ordered = rest.match(/^\s*\d+\.\s+/)
      if (ordered?.[0]) {
        k += ordered[0].length
        step = true
        advanced = true
      } else {
        const bullet = rest.match(/^\s*[-*+]\s+/)
        if (bullet?.[0]) {
          k += bullet[0].length
          step = true
          advanced = true
        }
      }
    }

    if (!step) break
  }

  return advanced ? k - i : 0
}

export function tokenizeWholeBodyAsPlainText(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
): MdSemTok[] {
  const text =
    bodySeg.endsWith('\n') && !bodySeg.endsWith('\\\n') ? bodySeg.slice(0, -1) : bodySeg
  if (!text.length) return []
  return [
    {
      text,
      kind: inheritedPlainKind,
      markdownFrom: baseAbs,
      markdownTo: baseAbs + text.length,
    },
  ]
}

export function tokenizeStructuredLinewiseMarkdownBody(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
  collapseSoftLineBreaks = false,
  stripTaskMarkers = false,
): MdSemTok[] | null {
  const out: MdSemTok[] = []
  const s = bodySeg
  const n = s.length
  let i = 0
  let emittedContent = false
  let pendingSeparatorAbs: number | null = null
  let pendingSeparatorKind: 'soft' | 'hard' | null = null

  while (i < n) {
    const lineStart = i
    let lineEnd = i
    while (lineEnd < n && s[lineEnd] !== '\n') lineEnd += 1

    const prefixLen = structuredLineBodyMinIndexInSeg(s.slice(lineStart, lineEnd), {
      stripTaskMarkers,
      includeCalloutMarker: false,
    })
    const contentStart = Math.min(lineEnd, lineStart + prefixLen)
    const hasContent = contentStart < lineEnd

    if (hasContent) {
      if (emittedContent && pendingSeparatorAbs != null && pendingSeparatorKind === 'hard') {
        out.push({
          text: '\n',
          kind: 'text',
          markdownFrom: pendingSeparatorAbs,
          markdownTo: pendingSeparatorAbs + 1,
        })
      }
      let inner = s.slice(contentStart, lineEnd)
      let hasExplicitHardBreak = false
      if (inner.endsWith('\\') && !isActiveMdEscape(inner, inner.length - 1)) {
        inner = inner.slice(0, -1)
        hasExplicitHardBreak = true
      }
      const innerTokens = tokenizeMarkdownBodyToSemanticTokens(
        inner,
        baseAbs + contentStart,
        inheritedPlainKind,
        false,
      )
      if (innerTokens == null) return null
      if (innerTokens.length === 0 && hasExplicitHardBreak) {
        out.push({
          text: '\n',
          kind: 'text',
          markdownFrom: baseAbs + contentStart,
          markdownTo: Math.min(baseAbs + lineEnd, baseAbs + contentStart + 1),
        })
      }
      out.push(...innerTokens)
      emittedContent = true
      const consumeStandaloneHardBreakAsOwnLine = hasExplicitHardBreak && innerTokens.length === 0
      pendingSeparatorAbs = consumeStandaloneHardBreakAsOwnLine ? null : lineEnd < n ? baseAbs + lineEnd : null
      pendingSeparatorKind = consumeStandaloneHardBreakAsOwnLine
        ? null
        : lineEnd < n
          ? hasExplicitHardBreak || !collapseSoftLineBreaks
            ? 'hard'
            : 'soft'
          : null
    } else if (emittedContent && pendingSeparatorAbs == null && lineEnd < n) {
      pendingSeparatorAbs = baseAbs + lineEnd
      pendingSeparatorKind = collapseSoftLineBreaks ? 'soft' : 'hard'
    }

    i = lineEnd < n ? lineEnd + 1 : n
  }

  return out
}

function isMarkdownTableSeparatorCell(text: string): boolean {
  const trimmed = text.trim()
  return /^:?-{3,}:?$/u.test(trimmed)
}

function extractMarkdownTableCellPayloadSpans(
  row: string,
  rowStart: number,
): ReadonlyArray<{ from: number; to: number }> {
  const rawSegments: Array<{ from: number; to: number }> = []
  let segStart = 0
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] !== '|' || isActiveMdEscape(row, i)) continue
    rawSegments.push({ from: segStart, to: i })
    segStart = i + 1
  }
  rawSegments.push({ from: segStart, to: row.length })

  let startIdx = 0
  let endIdx = rawSegments.length
  if (
    rawSegments.length > 0 &&
    row.slice(rawSegments[0]!.from, rawSegments[0]!.to).trim() === ''
  ) {
    startIdx = 1
  }
  if (
    endIdx > startIdx &&
    row.slice(rawSegments[endIdx - 1]!.from, rawSegments[endIdx - 1]!.to).trim() === ''
  ) {
    endIdx -= 1
  }

  const cells: Array<{ from: number; to: number }> = []
  for (let i = startIdx; i < endIdx; i += 1) {
    const seg = rawSegments[i]!
    let from = seg.from
    let to = seg.to
    while (from < to && (row[from] === ' ' || row[from] === '\t')) from += 1
    while (to > from && (row[to - 1] === ' ' || row[to - 1] === '\t')) to -= 1
    cells.push({ from: rowStart + from, to: rowStart + to })
  }
  return Object.freeze(cells)
}

export function tokenizeMarkdownTableBodyToSemanticTokens(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
): MdSemTok[] | null {
  const out: MdSemTok[] = []
  let lineStart = 0
  while (lineStart <= bodySeg.length) {
    let lineEnd = lineStart
    while (lineEnd < bodySeg.length && bodySeg[lineEnd] !== '\n') lineEnd += 1
    const row = bodySeg.slice(lineStart, lineEnd)
    if (row.trim().length > 0) {
      const cells = extractMarkdownTableCellPayloadSpans(row, lineStart)
      const isSeparatorRow =
        cells.length > 0 &&
        cells.every(({ from, to }) => isMarkdownTableSeparatorCell(bodySeg.slice(from, to)))
      if (!isSeparatorRow) {
        for (const cell of cells) {
          const inner = bodySeg.slice(cell.from, cell.to)
          const innerTokens = tokenizeMarkdownBodyToSemanticTokens(
            inner,
            baseAbs + cell.from,
            inheritedPlainKind,
            false,
          )
          if (innerTokens == null) return null
          out.push(...innerTokens)
        }
      }
    }
    if (lineEnd >= bodySeg.length) break
    lineStart = lineEnd + 1
  }
  return mergeAdjacentMdTokens(out)
}

function consumeHtmlInlineToken(
  s: string,
  i: number,
  baseAbs: number,
): { tok: MdSemTok; nextI: number } | null {
  if (s[i] !== '<' || isActiveMdEscape(s, i)) return null
  const n = s.length
  if (s.slice(i, i + 4) === '<!--') {
    const end = s.indexOf('-->', i + 4)
    if (end === -1) return null
    const hi = end + 3
    return {
      tok: {
        text: s.slice(i, hi),
        kind: 'html',
        markdownFrom: baseAbs + i,
        markdownTo: baseAbs + hi,
      },
      nextI: hi,
    }
  }
  const match = s.slice(i).match(/^<(\/?)([a-zA-Z][\w-]*)\b/)
  if (!match) return null
  const isClose = match[1] === '/'
  const tag = match[2]!
  let gt = i + match[0].length
  while (gt < n && s[gt] !== '>') gt += 1
  if (gt >= n || s[gt] !== '>') return null
  if (isClose) {
    const nextI = gt + 1
    return {
      tok: {
        text: s.slice(i, nextI),
        kind: 'html',
        markdownFrom: baseAbs + i,
        markdownTo: baseAbs + nextI,
      },
      nextI,
    }
  }
  if (gt > i + 1 && s[gt - 1] === '/') {
    const nextI = gt + 1
    return {
      tok: {
        text: s.slice(i, nextI),
        kind: 'html',
        markdownFrom: baseAbs + i,
        markdownTo: baseAbs + nextI,
      },
      nextI,
    }
  }
  const close = `</${tag}>`
  const ci = s.indexOf(close, gt + 1)
  if (ci === -1) return null
  const end = ci + close.length
  return {
    tok: {
      text: s.slice(i, end),
      kind: 'html',
      markdownFrom: baseAbs + i,
      markdownTo: baseAbs + end,
    },
    nextI: end,
  }
}

function consumeAutoLinkToken(
  s: string,
  i: number,
  baseAbs: number,
): { tok: MdSemTok; nextI: number } | null {
  if (s[i] !== '<' || isActiveMdEscape(s, i)) return null
  const close = s.indexOf('>', i + 1)
  if (close <= i + 1) return null
  const inner = s.slice(i + 1, close)
  if (!/^https?:\/\/\S+$/iu.test(inner)) return null
  return {
    tok: {
      text: inner,
      kind: 'link',
      markdownFrom: baseAbs + i + 1,
      markdownTo: baseAbs + close,
    },
    nextI: close + 1,
  }
}

function readFormattingWrapperOpenTag(
  s: string,
  i: number,
): { tagName: 'u' | 'span'; openEnd: number } | null {
  if (s[i] !== '<' || isActiveMdEscape(s, i)) return null
  const uMatch = s.slice(i).match(/^<u(?:\s[^>]*)?>/iu)
  if (uMatch?.[0]) {
    return { tagName: 'u', openEnd: i + uMatch[0].length }
  }
  const spanMatch = s.slice(i).match(/^<span\b[^>]*>/iu)
  if (spanMatch?.[0]) {
    const raw = spanMatch[0]
    if (!/\bstyle\s*=\s*["'][^"']*color\s*:/iu.test(raw)) return null
    return { tagName: 'span', openEnd: i + raw.length }
  }
  return null
}

function findFormattingWrapperCloseTag(
  s: string,
  from: number,
  tagName: 'u' | 'span',
): { innerEnd: number; closeEnd: number } | null {
  const closeTag = `</${tagName}>`
  let depth = 1
  let i = from
  while (i < s.length) {
    const open = readFormattingWrapperOpenTag(s, i)
    if (open && open.tagName === tagName) {
      depth += 1
      i = open.openEnd
      continue
    }
    if (s.slice(i, i + closeTag.length).toLowerCase() === closeTag) {
      depth -= 1
      if (depth === 0) {
        return { innerEnd: i, closeEnd: i + closeTag.length }
      }
      i += closeTag.length
      continue
    }
    i += 1
  }
  return null
}

const WIKI_LINK_TOKEN_RE =
  /^(!)?\[\[((?:[^\]|#^\\]|\\.)*?)(?:#((?:[^\]|^\\]|\\.)*?))?(?:\\?\^((?:[^\]|\\]|\\.)*?))?(?:\|((?:[^\]]|\\.)*?))?\]\]/u

function consumeInlineMathToken(
  s: string,
  i: number,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind,
): { tok: MdSemTok; nextI: number } | null {
  if (i >= s.length || s[i] !== '$' || isActiveMdEscape(s, i)) return null
  if (i + 1 < s.length && s[i + 1] === '$') return null
  let j = i + 1
  while (j < s.length) {
    if (s[j] === '$' && !isActiveMdEscape(s, j)) break
    j += 1
  }
  if (j >= s.length || s[j] !== '$') return null
  const inner = s.slice(i + 1, j)
  if (!inner.length) return null
  return {
    tok: {
      text: inner,
      kind: inheritedPlainKind,
      markdownFrom: baseAbs + i + 1,
      markdownTo: baseAbs + j,
    },
    nextI: j + 1,
  }
}

function consumeFootnoteRefToken(
  s: string,
  i: number,
  baseAbs: number,
): { tok: MdSemTok; nextI: number } | null {
  if (i >= s.length || s[i] !== '[' || isActiveMdEscape(s, i)) return null
  const match = /^\[\^([^\]\s][^\]]*)\]/u.exec(s.slice(i))
  if (!match?.[0]) return null
  const raw = match[0]
  return {
    tok: {
      text: raw,
      kind: 'text',
      markdownFrom: baseAbs + i,
      markdownTo: baseAbs + i + raw.length,
    },
    nextI: i + raw.length,
  }
}

function consumeHighlightToken(
  s: string,
  i: number,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind,
): { tok: MdSemTok; nextI: number } | null {
  if (i + 1 >= s.length || s[i] !== '=' || s[i + 1] !== '=' || isActiveMdEscape(s, i)) return null
  let j = i + 2
  while (j + 1 < s.length) {
    if (s[j] === '=' && s[j + 1] === '=' && !isActiveMdEscape(s, j)) break
    j += 1
  }
  if (j + 1 >= s.length || s[j] !== '=' || s[j + 1] !== '=') return null
  const inner = s.slice(i + 2, j)
  if (!inner.length) return null
  return {
    tok: {
      text: inner,
      kind: inheritedPlainKind,
      markdownFrom: baseAbs + i + 2,
      markdownTo: baseAbs + j,
    },
    nextI: j + 2,
  }
}

function consumeWikiLinkToken(
  s: string,
  i: number,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind,
): { tok: MdSemTok; nextI: number } | null {
  if (i >= s.length || isActiveMdEscape(s, i)) return null
  if (s[i] !== '[' && !(s[i] === '!' && i + 2 < s.length && s[i + 1] === '[' && s[i + 2] === '[')) {
    return null
  }
  const match = WIKI_LINK_TOKEN_RE.exec(s.slice(i))
  if (!match?.[0]) return null
  const raw = match[0]
  return {
    tok: {
      text: raw,
      kind: inheritedPlainKind,
      markdownFrom: baseAbs + i,
      markdownTo: baseAbs + i + raw.length,
    },
    nextI: i + raw.length,
  }
}

export function tokenizeMarkdownBodyToSemanticTokens(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
  allowLinePrefixSkipping = false,
): MdSemTok[] | null {
  const out: MdSemTok[] = []
  const s = bodySeg
  let i = 0
  const n = s.length

  while (i < n) {
    const isLineStart = i === 0 || s[i - 1] === '\n'
    const isHardBreakLineStart =
      s[i - 1] === '\n' && i >= 2 && s[i - 2] === '\\' && !isActiveMdEscape(s, i - 2)
    if (allowLinePrefixSkipping && isLineStart && !isHardBreakLineStart) {
      const pre = skipListOrBlockquoteLinePrefix(s, i)
      if (pre > 0) {
        i += pre
        continue
      }
    }

    const autoLinkConsumed = consumeAutoLinkToken(s, i, baseAbs)
    if (autoLinkConsumed != null) {
      out.push(autoLinkConsumed.tok)
      i = autoLinkConsumed.nextI
      continue
    }

    const formattingWrapper = readFormattingWrapperOpenTag(s, i)
    if (formattingWrapper) {
      const closed = findFormattingWrapperCloseTag(
        s,
        formattingWrapper.openEnd,
        formattingWrapper.tagName,
      )
      if (!closed) return null
      const inner = s.slice(formattingWrapper.openEnd, closed.innerEnd)
      const innerTokens = tokenizeMarkdownBodyToSemanticTokens(
        inner,
        baseAbs + formattingWrapper.openEnd,
        'html',
        allowLinePrefixSkipping,
      )
      if (innerTokens == null) return null
      out.push(...innerTokens)
      i = closed.closeEnd
      continue
    }

    const htmlConsumed = consumeHtmlInlineToken(s, i, baseAbs)
    if (htmlConsumed != null) {
      out.push(htmlConsumed.tok)
      i = htmlConsumed.nextI
      continue
    }

    const wikiConsumed = consumeWikiLinkToken(s, i, baseAbs, inheritedPlainKind)
    if (wikiConsumed != null) {
      out.push(wikiConsumed.tok)
      i = wikiConsumed.nextI
      continue
    }

    const inlineMathConsumed = consumeInlineMathToken(s, i, baseAbs, inheritedPlainKind)
    if (inlineMathConsumed != null) {
      out.push(inlineMathConsumed.tok)
      i = inlineMathConsumed.nextI
      continue
    }

    const footnoteRefConsumed = consumeFootnoteRefToken(s, i, baseAbs)
    if (footnoteRefConsumed != null) {
      out.push(footnoteRefConsumed.tok)
      i = footnoteRefConsumed.nextI
      continue
    }

    const highlightConsumed = consumeHighlightToken(s, i, baseAbs, inheritedPlainKind)
    if (highlightConsumed != null) {
      out.push(highlightConsumed.tok)
      i = highlightConsumed.nextI
      continue
    }

    if (s[i] === '\\' && !isActiveMdEscape(s, i)) {
      let slashRunEnd = i
      while (slashRunEnd < n && s[slashRunEnd] === '\\') slashRunEnd += 1
      if (slashRunEnd < n && s[slashRunEnd] === '\n') {
        const literalSlashCount = Math.floor((slashRunEnd - i) / 2)
        if (literalSlashCount > 0) {
          out.push({
            text: '\\'.repeat(literalSlashCount),
            kind: inheritedPlainKind,
            markdownFrom: baseAbs + i,
            markdownTo: baseAbs + i + literalSlashCount,
          })
        }
        out.push({
          text: '\n',
          kind: 'text',
          markdownFrom: baseAbs + slashRunEnd,
          markdownTo: baseAbs + slashRunEnd + 1,
        })
        i = slashRunEnd + 1
        continue
      }
    }

    if (s[i] === '\\' && i + 1 < n && !isActiveMdEscape(s, i)) {
      out.push({
        text: s[i + 1]!,
        kind: s[i + 1] === '\n' ? 'text' : inheritedPlainKind,
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + i + 2,
      })
      i += 2
      continue
    }

    if (s[i] === '`' && !isActiveMdEscape(s, i)) {
      let j = i + 1
      while (j < n && s[j] !== '`') j += 1
      if (j >= n) return null
      const inner = s.slice(i + 1, j)
      out.push({
        text: inner,
        kind: 'code',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + j,
      })
      i = j + 1
      continue
    }

    if (
      s[i] === '*' &&
      i + 2 < n &&
      s[i + 1] === '*' &&
      s[i + 2] === '*' &&
      !isActiveMdEscape(s, i)
    ) {
      let j = i + 3
      while (j + 2 < n) {
        if (
          s[j] === '*' &&
          s[j + 1] === '*' &&
          s[j + 2] === '*' &&
          !isActiveMdEscape(s, j)
        ) {
          break
        }
        j += 1
      }
      if (j + 2 >= n) {
        pushPlainTokenWithKind(out, s, i, i + 3, baseAbs, inheritedPlainKind)
        i += 3
        continue
      }
      const inner = s.slice(i + 3, j)
      out.push({
        text: inner,
        kind: 'strong',
        markdownFrom: baseAbs + i + 3,
        markdownTo: baseAbs + j,
      })
      i = j + 3
      continue
    }

    if (
      s[i] === '_' &&
      i + 2 < n &&
      s[i + 1] === '_' &&
      s[i + 2] === '_' &&
      !isActiveMdEscape(s, i)
    ) {
      let j = i + 3
      while (j + 2 < n) {
        if (
          s[j] === '_' &&
          s[j + 1] === '_' &&
          s[j + 2] === '_' &&
          !isActiveMdEscape(s, j)
        ) {
          break
        }
        j += 1
      }
      if (j + 2 >= n) {
        pushPlainTokenWithKind(out, s, i, i + 3, baseAbs, inheritedPlainKind)
        i += 3
        continue
      }
      const inner = s.slice(i + 3, j)
      out.push({
        text: inner,
        kind: 'strong',
        markdownFrom: baseAbs + i + 3,
        markdownTo: baseAbs + j,
      })
      i = j + 3
      continue
    }

    if (s[i] === '*' && i + 1 < n && s[i + 1] === '*' && !isActiveMdEscape(s, i)) {
      let j = i + 2
      while (j + 1 < n) {
        if (s[j] === '*' && s[j + 1] === '*' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j + 1 >= n) {
        pushPlainTokenWithKind(out, s, i, i + 2, baseAbs, inheritedPlainKind)
        i += 2
        continue
      }
      const inner = s.slice(i + 2, j)
      out.push({
        text: inner,
        kind: 'strong',
        markdownFrom: baseAbs + i + 2,
        markdownTo: baseAbs + j,
      })
      i = j + 2
      continue
    }

    if (s[i] === '_' && i + 1 < n && s[i + 1] === '_' && !isActiveMdEscape(s, i)) {
      let j = i + 2
      while (j + 1 < n) {
        if (s[j] === '_' && s[j + 1] === '_' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j + 1 >= n) {
        pushPlainTokenWithKind(out, s, i, i + 2, baseAbs, inheritedPlainKind)
        i += 2
        continue
      }
      const inner = s.slice(i + 2, j)
      out.push({
        text: inner,
        kind: 'strong',
        markdownFrom: baseAbs + i + 2,
        markdownTo: baseAbs + j,
      })
      i = j + 2
      continue
    }

    if (s[i] === '~' && i + 1 < n && s[i + 1] === '~' && !isActiveMdEscape(s, i)) {
      let j = i + 2
      while (j + 1 < n) {
        if (s[j] === '~' && s[j + 1] === '~' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j + 1 >= n) {
        pushPlainTokenWithKind(out, s, i, i + 2, baseAbs, inheritedPlainKind)
        i += 2
        continue
      }
      const inner = s.slice(i + 2, j)
      out.push({
        text: inner,
        kind: 'strike',
        markdownFrom: baseAbs + i + 2,
        markdownTo: baseAbs + j,
      })
      i = j + 2
      continue
    }

    if (s[i] === '^' && !isActiveMdEscape(s, i)) {
      let j = i + 1
      while (j < n) {
        if (s[j] === '^' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j >= n || s[j] !== '^') {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      const inner = s.slice(i + 1, j)
      if (!inner.length) {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      out.push({
        text: inner,
        kind: 'sup',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + j,
      })
      i = j + 1
      continue
    }

    if (s[i] === '~' && !isActiveMdEscape(s, i) && !(i + 1 < n && s[i + 1] === '~')) {
      let j = i + 1
      while (j < n) {
        if (
          s[j] === '~' &&
          !isActiveMdEscape(s, j) &&
          !(j + 1 < n && s[j + 1] === '~')
        ) {
          break
        }
        j += 1
      }
      if (j >= n || s[j] !== '~') {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      const inner = s.slice(i + 1, j)
      if (!inner.length) {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      out.push({
        text: inner,
        kind: 'sub',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + j,
      })
      i = j + 1
      continue
    }

    if (s[i] === '*' && !isActiveMdEscape(s, i)) {
      let j = i + 1
      while (j < n) {
        if (s[j] === '*' && !isActiveMdEscape(s, j)) {
          if (j + 1 < n && s[j + 1] === '*') {
            j += 1
            continue
          }
          break
        }
        j += 1
      }
      if (j >= n || s[j] !== '*') {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      const inner = s.slice(i + 1, j)
      out.push({
        text: inner,
        kind: 'em',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + j,
      })
      i = j + 1
      continue
    }

    if (s[i] === '_' && !isActiveMdEscape(s, i)) {
      let j = i + 1
      while (j < n) {
        if (s[j] === '_' && !isActiveMdEscape(s, j)) {
          if (j + 1 < n && s[j + 1] === '_') {
            j += 1
            continue
          }
          break
        }
        j += 1
      }
      if (j >= n || s[j] !== '_') {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      const inner = s.slice(i + 1, j)
      out.push({
        text: inner,
        kind: 'em',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + j,
      })
      i = j + 1
      continue
    }

    if (s[i] === '!' && i + 1 < n && s[i + 1] === '[' && !isActiveMdEscape(s, i)) {
      let j = i + 2
      let depth = 1
      while (j < n && depth > 0) {
        if (s[j] === '[' && !isActiveMdEscape(s, j)) depth += 1
        else if (s[j] === ']' && !isActiveMdEscape(s, j)) depth -= 1
        j += 1
      }
      if (depth !== 0) return null
      const labelEnd = j - 1
      if (labelEnd >= n || s[labelEnd] !== ']') return null
      if (labelEnd + 1 >= n || s[labelEnd + 1] !== '(') return null
      let k = labelEnd + 2
      let d = 1
      while (k < n && d > 0) {
        if (s[k] === '(' && !isActiveMdEscape(s, k)) d += 1
        else if (s[k] === ')' && !isActiveMdEscape(s, k)) d -= 1
        k += 1
      }
      if (d !== 0) return null
      const inner = s.slice(i + 2, labelEnd)
      out.push({
        text: inner,
        kind: 'image',
        markdownFrom: baseAbs + i + 2,
        markdownTo: baseAbs + labelEnd,
      })
      i = k
      continue
    }

    if (s[i] === '[' && !isActiveMdEscape(s, i)) {
      let j = i + 1
      let depth = 1
      while (j < n && depth > 0) {
        if (s[j] === '[' && !isActiveMdEscape(s, j)) depth += 1
        else if (s[j] === ']' && !isActiveMdEscape(s, j)) depth -= 1
        j += 1
      }
      if (depth !== 0) return null
      const labelEnd = j - 1
      if (labelEnd + 1 >= n || s[labelEnd + 1] !== '(') {
        pushPlainTokenWithKind(out, s, i, i + 1, baseAbs, inheritedPlainKind)
        i += 1
        continue
      }
      let k = labelEnd + 2
      let d = 1
      while (k < n && d > 0) {
        if (s[k] === '(' && !isActiveMdEscape(s, k)) d += 1
        else if (s[k] === ')' && !isActiveMdEscape(s, k)) d -= 1
        k += 1
      }
      if (d !== 0) return null
      const inner = s.slice(i + 1, labelEnd)
      out.push({
        text: inner,
        kind: 'link',
        markdownFrom: baseAbs + i + 1,
        markdownTo: baseAbs + labelEnd,
      })
      i = k
      continue
    }

    let j = i + 1
    while (j < n && !mdInlineSpecialWouldStart(s, j, n)) j += 1
    pushPlainTokenWithKind(out, s, i, j, baseAbs, inheritedPlainKind)
    i = j
  }

  return mergeAdjacentMdTokens(out)
}
