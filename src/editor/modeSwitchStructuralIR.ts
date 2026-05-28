import MarkdownIt from 'markdown-it'
import markdownItDeflist from 'markdown-it-deflist'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import type { Mark, Node as PMNode } from 'prosemirror-model'

import {
  collectProjectablePmLeafRows,
  freezeModeSwitchLeafPath,
  type ModeSwitchLeafPath,
} from './modeSwitchLeafRow'
import {
  isModeSwitchCollapsedAtomCarrierBlock,
  isModeSwitchFenceLikeBlock,
  isModeSwitchZeroPayloadStructuralBlock,
} from './modeSwitchBlockGeometry'
import { ModeSwitchFreezeError } from './modeSwitchFreezeFailure'
import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import { registerLunaFootnoteMarkdownRules } from './lunaFootnoteMarkdown'
import { formatLinkReferenceDefLine } from './lunaLinkReferenceDef'
import { registerLunaLinkReferenceDefMarkdownRules } from './lunaLinkReferenceDefMarkdown'
import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'

/** Same shape as the hierarchical reference in `modeSwitchSnapshot`*/
export type ModeSwitchFrozenHierarchicalRef = {
  readonly bufferHash: string
  readonly anchor: HierarchicalSelectionCore
  readonly head: HierarchicalSelectionCore
} | null

/** freeze-time slicing semantic class (IR metadata only; projection does not branch).*/
export type SemanticSliceKind =
  | 'text'
  | 'strong'
  | 'em'
  | 'code'
  | 'strike'
  | 'link'
  | 'html'
  | 'image'
  | 'task'

/**
 * Freeze semantic token: semantic intra interval + canonical pure payload half-open interval + absolute position within PM (only freeze writing).
 * `semanticFrom`…`semanticTo` (half-open): the same space as `intraBlockOffset`; within a single token
 * `markdownTo - markdownFrom === semanticTo - semanticFrom - 1` (payload length L).
 */
export type FrozenSemanticToken = {
  readonly semanticFrom: number
  readonly semanticTo: number
  readonly markdownFrom: number
  readonly markdownTo: number
  readonly pmFrom: number
  readonly pmToExclusive: number
  readonly kind: SemanticSliceKind
}

/**
 * Frozen mapping of semantic text coordinates (same space as `intraBlockOffset`) to canonical markdown half-open intervals.
 * Only built within freeze; `computeSelection` only does token lookup + constant offset (no ratio).
 */
export type SemanticSlice = FrozenSemanticToken

/** DEV: Additional diagnostics when zip fails (freeze fail-fast).*/
export type SemanticTokenizationError = {
  readonly blockIndex: number
  readonly rowKey?: string
  readonly pmTokenIndex: number
  readonly mdTokenIndex: number
  readonly pmText: string
  readonly mdText: string
  readonly pmKind: SemanticSliceKind
  readonly mdKind: SemanticSliceKind
  readonly canonicalExcerpt: string
}

/**
 * Unique projection substrate: frozen, normalized geometry (with intra scale `semanticExtent`).
 */
export type FrozenGeometryRow = {
  readonly blockIndex: number
  readonly rowKey: string
  readonly blockPath: ModeSwitchLeafPath
  readonly blockType: string
  readonly cmStart: number
  readonly cmEnd: number
  readonly pmStart: number
  readonly pmEnd: number
  /** Freeze is written by PM text ruler; runtime is only used as the upper bound of intra clamp and does not provide type explanation.*/
  readonly semanticExtent: number
  /** Override the semantics of [0, semanticExtent] → markdown frozen slices (ordered, end-to-end)*/
  readonly semanticSlices: readonly SemanticSlice[]
}

export type FrozenStructuralIR = {
  readonly canonicalFingerprint: string
  readonly blocks: readonly FrozenGeometryRow[]
}

type ModeSwitchSemanticBuildPath =
  | 'fence'
  | 'collapsed-atom-carrier'
  | 'zero-payload-structural'
  | 'inline-zip'

type ModeSwitchSemanticBuildLayer = 'structural_core' | 'precision_adapter'

/*═══ PRIVATE FREEZE-ONLY PRECOMPILER — scan logic must not be exported / must not be projected / viewport / runtime path import ═══*/

function textLenFullInBlock(block: PMNode): number {
  const r = block.content.size
  try {
    return block.textBetween(0, r, '\n', '\n').length
  } catch {
    return 0
  }
}

function getModeSwitchSemanticBuildPath(typeName: string): ModeSwitchSemanticBuildPath {
  if (isModeSwitchFenceLikeBlock(typeName)) return 'fence'
  if (isModeSwitchCollapsedAtomCarrierBlock(typeName)) return 'collapsed-atom-carrier'
  if (isModeSwitchZeroPayloadStructuralBlock(typeName)) return 'zero-payload-structural'
  return 'inline-zip'
}

function getModeSwitchSemanticBuildLayer(
  buildPath: ModeSwitchSemanticBuildPath,
): ModeSwitchSemanticBuildLayer {
  switch (buildPath) {
    case 'collapsed-atom-carrier':
    case 'zero-payload-structural':
      return 'structural_core'
    case 'fence':
    case 'inline-zip':
      return 'precision_adapter'
  }
}

/** Align canonical fence body span with PM `semanticExtent` (often differs by trailing newline). */
function alignFenceBodyMarkdownSpan(
  canonicalBuffer: string,
  bodyFrom: number,
  bodyTo: number,
  semanticExtent: number,
): { markdownFrom: number; markdownTo: number } {
  let to = bodyTo
  while (to - bodyFrom > semanticExtent && to > bodyFrom && canonicalBuffer[to - 1] === '\n') {
    to -= 1
  }
  if (to - bodyFrom > semanticExtent) {
    to = bodyFrom + semanticExtent
  }
  return { markdownFrom: bodyFrom, markdownTo: to }
}

function alignBodyMarkdownSpan(
  canonicalBuffer: string,
  bodyFrom: number,
  bodyTo: number,
  semanticExtent: number,
): { markdownFrom: number; markdownTo: number } {
  if (semanticExtent <= 0) {
    return { markdownFrom: bodyFrom, markdownTo: bodyFrom }
  }
  let to = bodyTo
  while (to - bodyFrom > semanticExtent && to > bodyFrom && canonicalBuffer[to - 1] === '\n') {
    to -= 1
  }
  if (to - bodyFrom > semanticExtent) {
    to = bodyFrom + semanticExtent
  }
  return { markdownFrom: bodyFrom, markdownTo: to }
}

type RawSeg = {
  markdownFrom: number
  markdownTo: number
  bodyFrom: number
  bodyTo: number
  stripLinePrefixes?: boolean
  collapseSoftLineBreaks?: boolean
  blockType?: string
  source?: string
}

type MdItTokenLike = {
  readonly type: string
  readonly tag?: string
  readonly map?: [number, number] | null
  readonly nesting?: number
  readonly info?: string
  readonly content?: string
  readonly meta?: Record<string, unknown> | null
  readonly attrGet?: (name: string) => string | null
  readonly level?: number
}

type BlockLineRange = {
  start: number
  end: number
  type: string
}

const modeSwitchIrMarkdownIt = MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
})

modeSwitchIrMarkdownIt.use(markdownItDeflist)
modeSwitchIrMarkdownIt.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false, output: 'html' },
})
modeSwitchIrMarkdownIt.enable(['table', 'strikethrough'], true)
registerLunaFootnoteMarkdownRules(modeSwitchIrMarkdownIt)
registerLunaLinkReferenceDefMarkdownRules(modeSwitchIrMarkdownIt)
modeSwitchIrMarkdownIt.block.ruler.before('paragraph', 'luna_toc_directive', (state, startLine, _endLine, silent) => {
  const pos = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (pos >= max) return false
  const line = state.src.slice(pos, max).replace(/\r$/u, '').trim()
  if (!/^\s*\[toc\]\s*$/iu.test(line)) return false
  if (silent) return true
  state.line = startLine + 1
  const token = state.push('toc_directive', '', 0)
  token.map = [startLine, state.line]
  token.markup = '[toc]'
  return true
})
modeSwitchIrMarkdownIt.block.ruler.before('fence', 'luna_raw_fence', (state, startLine, _endLine, silent) => {
  const line = state.src
    .slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
    .replace(/\r$/u, '')
  if (!/^\s*```\s*luna-raw\s*$/iu.test(line)) return false
  if (silent) return true

  let next = startLine + 1
  let rawSource = 'unknown'
  if (next < state.lineMax) {
    const l1 = state.src
      .slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
      .replace(/\r$/u, '')
    const sm = l1.match(/^\s*source:\s*(html|unknown|invalid)\s*$/iu)
    if (sm) {
      rawSource = sm[1]!.toLowerCase()
      next += 1
    }
  }

  const rawLines: string[] = []
  while (next < state.lineMax) {
    const bodyLine = state.src
      .slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
      .replace(/\r$/u, '')
    if (/^\s*```\s*$/u.test(bodyLine)) {
      next += 1
      break
    }
    rawLines.push(state.src.slice(state.bMarks[next], state.eMarks[next]).replace(/\r$/u, ''))
    next += 1
  }

  const token = state.push('luna_raw_block', '', 0)
  token.map = [startLine, next]
  token.attrSet('content', rawLines.join('\n'))
  token.attrSet('source', rawSource)
  state.line = next
  return true
})

function tokenAttr(token: MdItTokenLike, name: string): string | null {
  return typeof token.attrGet === 'function' ? token.attrGet(name) : null
}

function extractTopLevelBlockRangesFromTokens(tokens: readonly MdItTokenLike[]): BlockLineRange[] {
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

function buildLineStartOffsets(markdown: string): number[] {
  const starts = [0]
  for (let i = 0; i < markdown.length; i += 1) {
    if (markdown[i] === '\n') starts.push(i + 1)
  }
  if (starts[starts.length - 1] !== markdown.length) starts.push(markdown.length)
  return starts
}

function countVisibleTrailingBlankSegments(markdown: string, trailingRun: number): number {
  if (trailingRun <= 0) return 0
  if (!markdown.endsWith('\n')) return trailingRun
  return Math.max(0, trailingRun - 2)
}

function headingBodyMinIndexInSeg(seg: string, node: PMNode): number {
  if (node.type.name !== 'heading') return 0
  const level = Math.min(6, Math.max(1, Number((node.attrs as { level?: number }).level) || 1))
  let i = 0
  let hashes = 0
  while (i < seg.length && seg[i] === '#' && hashes < level) {
    hashes += 1
    i += 1
  }
  while (i < seg.length && (seg[i] === ' ' || seg[i] === '\t')) i += 1
  return i
}

function footnoteBodyMinIndexInSeg(seg: string): number {
  const m = seg.match(/^\[\^[^\]\s][^\]]*\]:\s?/u)
  return m?.[0]?.length ?? 0
}

function blockquoteBodyMinIndex(seg: string): number {
  let i = 0
  while (i < seg.length && (seg[i] === ' ' || seg[i] === '\t')) i += 1
  if (i < seg.length && seg[i] === '>') {
    i += 1
    while (i < seg.length && (seg[i] === ' ' || seg[i] === '\t')) i += 1
    return i
  }
  return 0
}

function listBodyMinIndex(seg: string, typeName: string): number {
  if (typeName === 'taskList' || typeName === 'taskItem') {
    const m = seg.match(/^\s*[-*+]\s+\[[ xX]\]\s+/)
    if (m?.[0]) return m[0].length
  }
  if (typeName === 'orderedList') {
    const m = seg.match(/^\s*\d+\.\s+/)
    if (m?.[0]) return m[0].length
  }
  if (typeName === 'bulletList') {
    const m = seg.match(/^\s*[-*+]\s+/)
    if (m?.[0]) return m[0].length
  }
  return 0
}

function syntaxAwareMinIndexInSeg(seg: string, node: PMNode): number {
  const t = node.type.name
  if (t === 'heading') return headingBodyMinIndexInSeg(seg, node)
  if (t === 'footnoteDef') return footnoteBodyMinIndexInSeg(seg)
  let m = blockquoteBodyMinIndex(seg)
  if (m > 0) return m
  m = listBodyMinIndex(seg, t)
  if (m > 0) return m
  return 0
}

function countBackslashesBefore(s: string, i: number): number {
  let c = 0
  for (let k = i - 1; k >= 0 && s[k] === '\\'; k -= 1) c += 1
  return c
}

function isActiveMdEscape(s: string, i: number): boolean {
  return countBackslashesBefore(s, i) % 2 === 1
}

function pmSliceKindFromMarks(marks: readonly Mark[]): SemanticSliceKind {
  for (const m of marks) {
    if (m.type.name === 'link') return 'link'
  }
  for (const m of marks) {
    if (m.type.name === 'bold') return 'strong'
  }
  for (const m of marks) {
    if (m.type.name === 'italic') return 'em'
  }
  for (const m of marks) {
    if (m.type.name === 'code') return 'code'
  }
  for (const m of marks) {
    if (m.type.name === 'strike') return 'strike'
  }
  for (const m of marks) {
    if (m.type.name === 'textColor') return 'html'
  }
  for (const m of marks) {
    if (m.type.name === 'underline') return 'html'
  }
  return 'text'
}

type PmSemTok = {
  text: string
  kind: SemanticSliceKind
  pmFrom: number
  pmToExclusive: number
}

function collectPmSemanticTokens(block: PMNode, pmInnerStart: number): PmSemTok[] | null {
  const out: PmSemTok[] = []
  try {
    block.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text ?? ''
        if (!text.length) return false
        const k = pmSliceKindFromMarks(node.marks)
        const pmFrom = pmInnerStart + pos
        out.push({ text, kind: k, pmFrom, pmToExclusive: pmFrom + text.length })
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
        const src = String((node.attrs as { source?: string })?.source ?? 'html')
        const pmFrom = pmInnerStart + pos
        const kind: SemanticSliceKind = src === 'html' ? 'html' : 'text'
        out.push({ text: raw, kind, pmFrom, pmToExclusive: pmFrom + raw.length })
        return false
      }
      return true
    })
  } catch {
    return null
  }
  if (shouldSkipLinePrefixesForNode(block) && out.length > 0) {
    const fullText = block.textBetween(0, block.content.size, '\n', '\n')
    const withSeparators = injectSyntheticPmGapTokensFromFullText(out, fullText, pmInnerStart)
    return withSeparators
  }
  return mergeAdjacentPmTokens(out)
}

type MdSemTok = {
  text: string
  kind: SemanticSliceKind
  markdownFrom: number
  markdownTo: number
}

function mergeAdjacentMdTokens(toks: readonly MdSemTok[]): MdSemTok[] {
  if (!toks.length) return []
  const merged: MdSemTok[] = [{ ...toks[0]! }]
  for (let i = 1; i < toks.length; i += 1) {
    const next = toks[i]!
    const last = merged[merged.length - 1]!
    const crossesHardBreakBoundary = last.text === '\n' || next.text === '\n'
    if (
      last.kind === next.kind &&
      last.markdownTo === next.markdownFrom &&
      !crossesHardBreakBoundary
    ) {
      merged[merged.length - 1] = {
        text: last.text + next.text,
        kind: last.kind,
        markdownFrom: last.markdownFrom,
        markdownTo: next.markdownTo,
      }
    } else {
      merged.push({ ...next })
    }
  }
  return merged
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

function injectSyntheticPmGapTokensFromFullText(
  toks: readonly PmSemTok[],
  fullText: string,
  pmInnerStart: number,
): PmSemTok[] {
  if (!toks.length || !fullText.length) return [...toks]
  const out: PmSemTok[] = []
  let cursor = 0
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i]!
    const at = fullText.indexOf(t.text, cursor)
    if (at < 0) return [...toks]
    const gapText = fullText.slice(cursor, at)
    if (gapText.length > 0) {
      const prevPmEnd = out.length > 0 ? out[out.length - 1]!.pmToExclusive : Math.max(pmInnerStart, t.pmFrom - gapText.length)
      if (t.pmFrom - prevPmEnd < gapText.length) return [...toks]
      out.push({
        text: gapText,
        kind: 'text',
        pmFrom: prevPmEnd,
        pmToExclusive: prevPmEnd + gapText.length,
      })
    }
    out.push({ ...t })
    cursor = at + t.text.length
  }
  return out
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
  if (s[j] === '*' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '_' && !isActiveMdEscape(s, j)) return true
  if (s[j] === '\\' && j + 1 < n && !isActiveMdEscape(s, j)) return true
  return false
}

function skipListOrBlockquoteLinePrefix(s: string, i: number): number {
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

    const task = rest.match(/^\s*[-*+]\s+\[[ xX]\]\s+/)
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

function shouldSkipLinePrefixesForNode(node: PMNode): boolean {
  const t = node.type.name
  return (
    t === 'blockquote' ||
    t === 'bulletList' ||
    t === 'orderedList' ||
    t === 'taskList' ||
    t === 'taskItem'
  )
}

function tokenizeWholeBodyAsPlainText(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
): MdSemTok[] {
  const text = bodySeg.endsWith('\n') && !bodySeg.endsWith('\\\n') ? bodySeg.slice(0, -1) : bodySeg
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

function tokenizeStructuredLinewiseMarkdownBody(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
  collapseSoftLineBreaks = false,
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

    const prefixLen = skipListOrBlockquoteLinePrefix(s, lineStart)
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
      out.push(...innerTokens)
      emittedContent = true
      pendingSeparatorAbs = lineEnd < n ? baseAbs + lineEnd : null
      pendingSeparatorKind = lineEnd < n
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

function consumeHtmlInlineToken(s: string, i: number, baseAbs: number): { tok: MdSemTok; nextI: number } | null {
  if (s[i] !== '<' || isActiveMdEscape(s, i)) return null
  const n = s.length
  if (s.slice(i, i + 4) === '<!--') {
    const end = s.indexOf('-->', i + 4)
    if (end === -1) return null
    const hi = end + 3
    return {
      tok: { text: s.slice(i, hi), kind: 'html', markdownFrom: baseAbs + i, markdownTo: baseAbs + hi },
      nextI: hi,
    }
  }
  const m = s.slice(i).match(/^<(\/?)([a-zA-Z][\w-]*)\b/)
  if (!m) return null
  const isClose = m[1] === '/'
  const tag = m[2]!
  let gt = i + m[0].length
  while (gt < n && s[gt] !== '>') gt += 1
  if (gt >= n || s[gt] !== '>') return null
  if (isClose) {
    const nextI = gt + 1
    return {
      tok: { text: s.slice(i, nextI), kind: 'html', markdownFrom: baseAbs + i, markdownTo: baseAbs + nextI },
      nextI,
    }
  }
  if (gt > i + 1 && s[gt - 1] === '/') {
    const nextI = gt + 1
    return {
      tok: { text: s.slice(i, nextI), kind: 'html', markdownFrom: baseAbs + i, markdownTo: baseAbs + nextI },
      nextI,
    }
  }
  const close = `</${tag}>`
  const ci = s.indexOf(close, gt + 1)
  if (ci === -1) return null
  const end = ci + close.length
  return {
    tok: { text: s.slice(i, end), kind: 'html', markdownFrom: baseAbs + i, markdownTo: baseAbs + end },
    nextI: end,
  }
}

function consumeAutoLinkToken(s: string, i: number, baseAbs: number): { tok: MdSemTok; nextI: number } | null {
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

/** freeze-only: markdown text segment → semantic token stream (payload half-open interval, no block-level prefix).*/
function tokenizeMarkdownBodyToSemanticTokens(
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

    const htmlConsumed = consumeHtmlInlineToken(s, i, baseAbs)
    if (htmlConsumed != null) {
      out.push(htmlConsumed.tok)
      i = htmlConsumed.nextI
      continue
    }

    const formattingWrapper = readFormattingWrapperOpenTag(s, i)
    if (formattingWrapper) {
      const closed = findFormattingWrapperCloseTag(s, formattingWrapper.openEnd, formattingWrapper.tagName)
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
        if (s[j] === '*' && s[j + 1] === '*' && s[j + 2] === '*' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j + 2 >= n) return null
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
        if (s[j] === '_' && s[j + 1] === '_' && s[j + 2] === '_' && !isActiveMdEscape(s, j)) break
        j += 1
      }
      if (j + 2 >= n) return null
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
      if (j + 1 >= n) return null
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
      if (j + 1 >= n) return null
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
      if (j + 1 >= n) return null
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
      if (j >= n || s[j] !== '*') return null
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
      if (j >= n || s[j] !== '_') return null
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

function zipPmMdSemanticTokens(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
  semanticExtent: number,
): SemanticSlice[] | null {
  if (pm.length !== md.length) return null
  for (let i = 0; i < pm.length; i += 1) {
    if (pm[i]!.kind !== md[i]!.kind) return null
    if (pm[i]!.text !== md[i]!.text) return null
    const L = pm[i]!.text.length
    const mdw = md[i]!.markdownTo - md[i]!.markdownFrom
    if (L !== mdw) return null
  }
  const slices: SemanticSlice[] = []
  let b = 0
  for (let i = 0; i < pm.length; i += 1) {
    const p = pm[i]!
    const m = md[i]!
    const L = p.text.length
    slices.push({
      semanticFrom: b,
      semanticTo: b + L + 1,
      markdownFrom: m.markdownFrom,
      markdownTo: m.markdownTo,
      kind: p.kind,
      pmFrom: p.pmFrom,
      pmToExclusive: p.pmToExclusive,
    })
    b += L
  }
  if (b !== semanticExtent) return null
  return slices
}

function repartitionPmTokensToMatchMd(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
): PmSemTok[] | null {
  const repartitioned: PmSemTok[] = []
  let pmIndex = 0
  let pmOffset = 0

  for (const mdTok of md) {
    let remaining = mdTok.text
    let segmentStart: number | null = null
    let segmentEnd: number | null = null

    while (remaining.length > 0) {
      const pmTok = pm[pmIndex]
      if (!pmTok || pmTok.kind !== mdTok.kind) return null

      const pmText = pmTok.text.slice(pmOffset)
      if (!pmText.length) {
        pmIndex += 1
        pmOffset = 0
        continue
      }

      const take = Math.min(remaining.length, pmText.length)
      const pmChunk = pmText.slice(0, take)
      const mdChunk = remaining.slice(0, take)
      if (pmChunk !== mdChunk) return null

      const chunkFrom = pmTok.pmFrom + pmOffset
      const chunkTo = chunkFrom + take
      if (segmentStart == null) segmentStart = chunkFrom
      segmentEnd = chunkTo

      remaining = remaining.slice(take)
      pmOffset += take
      if (pmOffset >= pmTok.text.length) {
        pmIndex += 1
        pmOffset = 0
      }
    }

    if (segmentStart == null || segmentEnd == null) return null
    repartitioned.push({
      text: mdTok.text,
      kind: mdTok.kind,
      pmFrom: segmentStart,
      pmToExclusive: segmentEnd,
    })
  }

  if (pmIndex < pm.length - 1) return null
  if (pmIndex === pm.length - 1 && pmOffset !== pm[pmIndex]!.text.length) return null
  return repartitioned
}

/** DEV: PM/Markdown semantic token streams must be identical token-by-token before zipping (except for freeze proven invariants, which are asserted again).*/
export function assertStrictSemanticTokenParity(
  pm: readonly PmSemTok[],
  md: readonly MdSemTok[],
  semanticExtent: number,
  canonicalBuffer: string,
): void {
  if (!import.meta.env.DEV) return
  const fail = (msg: string, extra?: Record<string, unknown>) => {
     
    console.error('[mode-switch] assertStrictSemanticTokenParity', msg, extra)
    throw new Error(`[mode-switch] ${msg}`)
  }
  if (pm.length !== md.length) {
    fail('PM / Markdown token count mismatch', { pmLen: pm.length, mdLen: md.length })
  }
  let join = 0
  for (let i = 0; i < pm.length; i += 1) {
    const p = pm[i]!
    const m = md[i]!
    if (p.kind !== m.kind) fail('token kind mismatch', { i, p, m })
    if (p.text !== m.text) fail('token text mismatch', { i, p, m })
    const L = p.text.length
    const mdw = m.markdownTo - m.markdownFrom
    if (L !== mdw) fail('token payload length mismatch', { i, L, mdw, p, m })
    join += L
    if (m.markdownFrom > m.markdownTo) fail('invalid markdown span', { i, m })
    if (i > 0) {
      const prev = md[i - 1]!
      if (m.markdownFrom < prev.markdownTo) {
        fail('markdown token payloads overlap', { i, prev, m })
      }
    }
    if (L > 0) {
      const pay = canonicalBuffer.slice(m.markdownFrom, m.markdownTo)
      if (pay !== p.text) fail('canonical payload !== PM token text', { i, pay, p })
    }
  }
  if (join !== semanticExtent) {
    fail('joined token text length !== semanticExtent', { join, semanticExtent })
  }
}

function mergeAdjacentPmTokens(toks: PmSemTok[]): PmSemTok[] {
  if (!toks.length) return []
  const r: PmSemTok[] = [{ ...toks[0]! }]
  for (let i = 1; i < toks.length; i += 1) {
    const t = toks[i]!
    const last = r[r.length - 1]!
    const crossesHardBreakBoundary = last.text === '\n' || t.text === '\n'
    if (last.kind === t.kind && last.pmToExclusive === t.pmFrom && !crossesHardBreakBoundary) {
      r[r.length - 1] = {
        text: last.text + t.text,
        kind: last.kind,
        pmFrom: last.pmFrom,
        pmToExclusive: t.pmToExclusive,
      }
    } else {
      r.push({ ...t })
    }
  }
  return r
}

function throwStrictSemanticCompileFailure(args: {
  blockIndex: number
  rowKey?: string
  blockType: string
  semanticExtent: number
  segmentBase: number
  bodyRel: number
  bodySeg: string
  reason: string
  canonicalBuffer: string
  pmTok: readonly PmSemTok[]
  mdTok: readonly MdSemTok[] | null
}): never {
  const { blockIndex, rowKey, blockType, semanticExtent, segmentBase, bodyRel, bodySeg, reason, canonicalBuffer, pmTok, mdTok } = args
  const excerptFrom = Math.max(0, segmentBase - 32)
  const detail = {
    reason,
    blockIndex,
    rowKey,
    blockType,
    semanticExtent,
    segmentBase,
    bodyRel,
    bodySegLen: bodySeg.length,
    bodySegPreview: bodySeg.slice(0, 280),
    pmTokenCount: pmTok.length,
    mdTokenCount: mdTok?.length ?? null,
    pmJoinLen: pmTok.map((t) => t.text).join('').length,
    mdJoinLen: mdTok?.map((t) => t.text).join('').length ?? null,
    pmTokenDump: pmTok.map((t, i) => ({
      i,
      kind: t.kind,
      text: t.text,
      len: t.text.length,
      pmFrom: t.pmFrom,
      pmToExclusive: t.pmToExclusive,
    })),
    mdTokenDump:
      mdTok?.map((t, i) => ({
        i,
        kind: t.kind,
        text: t.text,
        len: t.text.length,
        markdownFrom: t.markdownFrom,
        markdownTo: t.markdownTo,
      })) ?? null,
    canonicalExcerpt: canonicalBuffer.slice(
      excerptFrom,
      Math.min(canonicalBuffer.length, segmentBase + 360),
    ),
  }
  throw new ModeSwitchFreezeError(
    `[mode-switch] freeze strict semantic tokenization failed (block ${blockIndex}): ${reason}`,
    detail as Record<string, unknown>,
  )
}

function compileInlineSemanticSlices(args: {
  node: PMNode
  seg: string
  segmentBase: number
  pmInnerStart: number
  semanticExtent: number
  blockIndex: number
  rowKey?: string
  canonicalBuffer: string
  stripLinePrefixes?: boolean
  collapseSoftLineBreaks?: boolean
}): readonly SemanticSlice[] {
  const {
    node,
    seg,
    segmentBase,
    pmInnerStart,
    semanticExtent,
    blockIndex,
    rowKey,
    canonicalBuffer,
    stripLinePrefixes,
    collapseSoftLineBreaks,
  } = args
  const bodyRel = syntaxAwareMinIndexInSeg(seg, node)
  const bodySeg = seg.slice(bodyRel)
  const baseAbs = segmentBase + bodyRel
  const rawPm = collectPmSemanticTokens(node, pmInnerStart)
  if (rawPm == null) {
    throwStrictSemanticCompileFailure({
      blockIndex,
      rowKey,
      blockType: node.type.name,
      semanticExtent,
      segmentBase,
      bodyRel,
      bodySeg,
      reason: 'pm_semantic_token_collect_null',
      canonicalBuffer,
      pmTok: [],
      mdTok: null,
    })
  }
  const pmTok = mergeAdjacentPmTokens(rawPm)
  const allowLinePrefixSkipping = stripLinePrefixes ?? shouldSkipLinePrefixesForNode(node)
  const mdTok = allowLinePrefixSkipping
    ? tokenizeStructuredLinewiseMarkdownBody(bodySeg, baseAbs, 'text', collapseSoftLineBreaks ?? false)
    : tokenizeMarkdownBodyToSemanticTokens(bodySeg, baseAbs, 'text', false)
  const trimmedTerminalNewline =
    bodySeg.endsWith('\n') && !bodySeg.endsWith('\\\n') ? bodySeg.slice(0, -1) : null
  const mdTokWithoutTerminalNewline =
    trimmedTerminalNewline != null
      ? allowLinePrefixSkipping
        ? tokenizeStructuredLinewiseMarkdownBody(
            trimmedTerminalNewline,
            baseAbs,
            'text',
            collapseSoftLineBreaks ?? false,
          )
        : tokenizeMarkdownBodyToSemanticTokens(
            trimmedTerminalNewline,
            baseAbs,
            'text',
            false,
          )
      : null
  if (mdTok == null && mdTokWithoutTerminalNewline == null) {
    throwStrictSemanticCompileFailure({
      blockIndex,
      rowKey,
      blockType: node.type.name,
      semanticExtent,
      segmentBase,
      bodyRel,
      bodySeg,
      reason: 'markdown_semantic_tokenizer_returned_null',
      canonicalBuffer,
      pmTok,
      mdTok: null,
    })
  }

  const selectedMdTok = (() => {
    if (mdTok != null) {
      const zipped = zipPmMdSemanticTokens(pmTok, mdTok, semanticExtent)
      if (zipped != null) return { pmTok, mdTok, zipped }
      const repartitionedPmTok = repartitionPmTokensToMatchMd(pmTok, mdTok)
      if (repartitionedPmTok != null) {
        const repartitionedZip = zipPmMdSemanticTokens(repartitionedPmTok, mdTok, semanticExtent)
        if (repartitionedZip != null) return { pmTok: repartitionedPmTok, mdTok, zipped: repartitionedZip }
      }
    }
    if (mdTokWithoutTerminalNewline != null) {
      const zipped = zipPmMdSemanticTokens(pmTok, mdTokWithoutTerminalNewline, semanticExtent)
      if (zipped != null) return { pmTok, mdTok: mdTokWithoutTerminalNewline, zipped }
      const repartitionedPmTok = repartitionPmTokensToMatchMd(pmTok, mdTokWithoutTerminalNewline)
      if (repartitionedPmTok != null) {
        const repartitionedZip = zipPmMdSemanticTokens(repartitionedPmTok, mdTokWithoutTerminalNewline, semanticExtent)
        if (repartitionedZip != null) {
          return { pmTok: repartitionedPmTok, mdTok: mdTokWithoutTerminalNewline, zipped: repartitionedZip }
        }
      }
    }
    if (node.type.name === 'heading') {
      const plainHeadingMdTok = tokenizeWholeBodyAsPlainText(bodySeg, baseAbs)
      const zipped = zipPmMdSemanticTokens(pmTok, plainHeadingMdTok, semanticExtent)
      if (zipped != null) return { pmTok, mdTok: plainHeadingMdTok, zipped }
    }
    return null
  })()

  const effectiveMdTok = selectedMdTok?.mdTok ?? mdTok ?? mdTokWithoutTerminalNewline ?? []

  if (semanticExtent === 0 && pmTok.length === 0 && effectiveMdTok.length === 0) {
    return Object.freeze([
      Object.freeze({
        semanticFrom: 0,
        semanticTo: 1,
        markdownFrom: baseAbs,
        markdownTo: baseAbs,
        kind: 'text' as const,
        pmFrom: pmInnerStart,
        pmToExclusive: pmInnerStart + 1,
      }),
    ])
  }

  if (selectedMdTok == null) {
    throwStrictSemanticCompileFailure({
      blockIndex,
      rowKey,
      blockType: node.type.name,
      semanticExtent,
      segmentBase,
      bodyRel,
      bodySeg,
      reason: 'strict_zip_failed_or_semantic_extent_mismatch',
      canonicalBuffer,
      pmTok,
      mdTok: effectiveMdTok,
    })
  }

  if (import.meta.env.DEV) {
    assertStrictSemanticTokenParity(selectedMdTok.pmTok, selectedMdTok.mdTok, semanticExtent, canonicalBuffer)
  }

  return Object.freeze(selectedMdTok.zipped.map((s) => Object.freeze(s)))
}

/**
 * DEV: Verify that `semanticSlices` is a piecewise monotonic coverage of [0, semanticExtent] (failure throw).
 */
export function assertSemanticSlicesCoverSemanticSpace(
  slices: readonly SemanticSlice[],
  semanticExtent: number,
  canonicalBuffer: string,
  ctx?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return
  const safeStringify = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const fail = (msg: string, extra?: Record<string, unknown>) => {
    console.error('[mode-switch] assertSemanticSlicesCoverSemanticSpace', msg, extra)
    console.error(
      '[mode-switch] assertSemanticSlicesCoverSemanticSpace detail',
      safeStringify({
        msg,
        semanticExtent,
        expectedSemanticToExclusive: semanticExtent + 1,
        actualSemanticToExclusive: slices[slices.length - 1]?.semanticTo ?? null,
        sliceCount: slices.length,
        slices: slices.map((s, i) => ({
          i,
          semanticFrom: s.semanticFrom,
          semanticTo: s.semanticTo,
          markdownFrom: s.markdownFrom,
          markdownTo: s.markdownTo,
          markdownLen: s.markdownTo - s.markdownFrom,
          pmFrom: s.pmFrom,
          pmToExclusive: s.pmToExclusive,
          pmLen: s.pmToExclusive - s.pmFrom,
          kind: s.kind,
        })),
        ctx: ctx ?? null,
        extra: extra ?? null,
      }),
    )
    throw new Error(`[mode-switch] ${msg}`)
  }
  const canonicalLen = canonicalBuffer.length
  if (!slices.length) fail('empty semanticSlices')
  if (slices[0]!.semanticFrom !== 0) fail('slices must start at semantic 0', { first: slices[0] })
  if (slices[slices.length - 1]!.semanticTo !== semanticExtent + 1) {
    fail('slices must end at semanticExtent + 1 (exclusive)', {
      last: slices[slices.length - 1],
      semanticExtent,
      slices,
      ...ctx,
    })
  }
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    if (s.semanticFrom >= s.semanticTo) fail('semanticFrom >= semanticTo (exclusive)', { i, s })
    if (s.markdownFrom > s.markdownTo) fail('markdownFrom > markdownTo', { i, s })
    if (canonicalLen > 0 && (s.markdownFrom < 0 || s.markdownTo > canonicalLen)) {
      fail('markdown slice out of canonical buffer', { i, s, canonicalLen })
    }
    if (i > 0) {
      const p = slices[i - 1]!
      if (s.semanticFrom !== p.semanticTo - 1) {
        fail('semantic slices not boundary-overlapped by one semantic unit', { i, prev: p, cur: s })
      }
      if (s.markdownFrom < p.markdownTo) {
        fail('markdown slices not monotone / overlap', { i, prev: p, cur: s })
      }
    }
  }
}

/**
 * DEV: frozen semantic token numerical invariant (payload length ↔ semantic half-open width ↔ PM span; payload total length ↔ semanticExtent).
 */
export function assertSemanticTokenDeterminism(
  slices: readonly SemanticSlice[],
  semanticExtent: number,
  canonicalBuffer: string,
  ctx?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return
  const safeStringify = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const fail = (msg: string, extra?: Record<string, unknown>) => {
    console.error('[mode-switch] assertSemanticTokenDeterminism', msg, extra)
    console.error(
      '[mode-switch] assertSemanticTokenDeterminism detail',
      safeStringify({
        msg,
        semanticExtent,
        sliceCount: slices.length,
        slices: slices.map((s, i) => ({
          i,
          semanticFrom: s.semanticFrom,
          semanticTo: s.semanticTo,
          markdownFrom: s.markdownFrom,
          markdownTo: s.markdownTo,
          markdownLen: s.markdownTo - s.markdownFrom,
          pmFrom: s.pmFrom,
          pmToExclusive: s.pmToExclusive,
          pmLen: s.pmToExclusive - s.pmFrom,
          kind: s.kind,
          markdownPreview:
            s.markdownTo > s.markdownFrom
              ? canonicalBuffer.slice(s.markdownFrom, Math.min(s.markdownTo, s.markdownFrom + 120))
              : '',
        })),
        ctx: ctx ?? null,
        extra: extra ?? null,
      }),
    )
    throw new Error(`[mode-switch] ${msg}`)
  }
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    const semW = s.semanticTo - s.semanticFrom
    if (semW < 1) fail('empty semantic span', { i, s })
    const L = s.markdownTo - s.markdownFrom
    if (L !== semW - 1) {
      if (!(L === 0 && semW === 1)) {
        fail('markdown payload length !== semantic intra width - 1', { i, s, semW, L, ...ctx })
      }
    }
    const pmW = s.pmToExclusive - s.pmFrom
    if (L > 0 && pmW !== L) {
      fail('PM span !== markdown payload length', { i, s, pmW, L })
    }
    if (L === 0 && semW === 1 && pmW > 1) {
      fail('degenerate semantic token has oversized PM span', { i, s, pmW })
    }
    if (L > 0) {
      const pay = canonicalBuffer.slice(s.markdownFrom, s.markdownTo)
      if (pay.length !== L) fail('canonical slice length mismatch', { i, s })
    }
  }
  let sumL = 0
  for (const s of slices) {
    sumL += s.markdownTo - s.markdownFrom
  }
  if (sumL !== semanticExtent) {
    fail('sum of markdown payloads !== semanticExtent', { sumL, semanticExtent, slices, ...ctx })
  }
}

/**
 * DEV: Disable legacy "wide range" fallback; and verify that the markdown payload width ↔ semantic half-width of each token is consistent.
 */
export function assertNoSemanticFallback(row: FrozenGeometryRow): void {
  if (!import.meta.env.DEV) return
  const { semanticSlices: slices, cmStart, cmEnd, semanticExtent } = row
  for (let i = 0; i < slices.length; i += 1) {
    const s = slices[i]!
    const semW = s.semanticTo - s.semanticFrom
    const L = s.markdownTo - s.markdownFrom
    if (L !== semW - 1 && !(L === 0 && semW === 1)) {
      throw new Error(
        `[mode-switch] assertNoSemanticFallback: markdown payload vs semantic intra width mismatch (slice ${i})`,
      )
    }
  }
  let sumL = 0
  for (const s of slices) {
    sumL += s.markdownTo - s.markdownFrom
  }
  if (sumL !== semanticExtent) {
    throw new Error('[mode-switch] assertNoSemanticFallback: sum(markdown payload) !== semanticExtent')
  }
  if (slices.length === 1) {
    const s0 = slices[0]!
    const L = s0.markdownTo - s0.markdownFrom
    const rowSpan = cmEnd - cmStart
    if (L === rowSpan && L > semanticExtent + 2) {
      throw new Error(
        '[mode-switch] assertNoSemanticFallback: suspicious wide single-slice markdown span (legacy heuristic fallback)',
      )
    }
  }
}

function buildSemanticSlicesForBlock(args: {
  node: PMNode
  raw: RawSeg
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  pmEnd: number
  blockIndex: number
  rowKey?: string
}): readonly SemanticSlice[] {
  const { node, raw, canonicalBuffer, semanticExtent, pmStart, pmEnd: _pmEnd, blockIndex, rowKey } = args
  const semanticBuildPath = getModeSwitchSemanticBuildPath(node.type.name)
  const assertionCtxBase = {
    blockIndex,
    rowKey,
    blockType: node.type.name,
    semanticBuildPath,
    semanticBuildLayer: getModeSwitchSemanticBuildLayer(semanticBuildPath),
    semanticExtent,
    rawMarkdownFrom: raw.markdownFrom,
    rawMarkdownTo: raw.markdownTo,
    rawBodyFrom: raw.bodyFrom,
    rawBodyTo: raw.bodyTo,
    pmStart,
    pmEnd: _pmEnd,
  } as const

  const pmSpanFromBlockTokens = (): { pmFrom: number; pmToExclusive: number } => {
    const rawPm = collectPmSemanticTokens(node, pmStart)
    const merged = rawPm ? mergeAdjacentPmTokens(rawPm) : []
    if (!merged.length) return { pmFrom: pmStart, pmToExclusive: pmStart + 1 }
    return {
      pmFrom: merged[0]!.pmFrom,
      pmToExclusive: merged[merged.length - 1]!.pmToExclusive,
    }
  }

  // Structural core only guarantees stable leaf rows, block geometry, and conservative
  // semantic extents. Precision adapters are the only layer allowed to spend effort on
  // token-by-token markdown payload alignment.
  switch (semanticBuildPath) {
    case 'fence': {
    const { pmFrom, pmToExclusive } = pmSpanFromBlockTokens()
    const { markdownFrom, markdownTo } = alignFenceBodyMarkdownSpan(
      canonicalBuffer,
      raw.bodyFrom,
      raw.bodyTo,
      semanticExtent,
    )
    const fenceSlices = Object.freeze([
      Object.freeze({
        semanticFrom: 0,
        semanticTo: semanticExtent + 1,
        markdownFrom,
        markdownTo,
        kind: 'text' as const,
        pmFrom,
        pmToExclusive,
      }),
    ])
    if (import.meta.env.DEV) {
      assertSemanticSlicesCoverSemanticSpace(fenceSlices, semanticExtent, canonicalBuffer, {
        ...assertionCtxBase,
      })
      assertSemanticTokenDeterminism(fenceSlices, semanticExtent, canonicalBuffer, {
        ...assertionCtxBase,
      })
      assertNoSemanticFallback({
        blockIndex,
        rowKey: `legacy:${blockIndex}`,
        blockPath: freezeModeSwitchLeafPath([blockIndex]),
        blockType: node.type.name,
        cmStart: fenceSlices[0]!.markdownFrom,
        cmEnd: fenceSlices[0]!.markdownTo,
        pmStart,
        pmEnd: _pmEnd,
        semanticExtent,
        semanticSlices: fenceSlices,
      })
    }
    return fenceSlices
    }

    case 'collapsed-atom-carrier': {
    const source = String((node.attrs as { source?: string } | null | undefined)?.source ?? 'unknown')
    const alignedBody = alignBodyMarkdownSpan(canonicalBuffer, raw.bodyFrom, raw.bodyTo, semanticExtent)
    const collapsedSlices = Object.freeze([
      Object.freeze({
        semanticFrom: 0,
        semanticTo: semanticExtent + 1,
        markdownFrom: alignedBody.markdownFrom,
        markdownTo: alignedBody.markdownTo,
        kind: (source === 'html' ? 'html' : 'text') as SemanticSliceKind,
        pmFrom: pmStart,
        pmToExclusive: pmStart + 1,
      }),
    ])
    if (import.meta.env.DEV) {
      assertSemanticSlicesCoverSemanticSpace(collapsedSlices, semanticExtent, canonicalBuffer, {
        ...assertionCtxBase,
        source,
      })
      assertNoSemanticFallback({
        blockIndex,
        rowKey: `legacy:${blockIndex}`,
        blockPath: freezeModeSwitchLeafPath([blockIndex]),
        blockType: node.type.name,
        cmStart: collapsedSlices[0]!.markdownFrom,
        cmEnd: collapsedSlices[0]!.markdownTo,
        pmStart,
        pmEnd: _pmEnd,
        semanticExtent,
        semanticSlices: collapsedSlices,
      })
    }
    return collapsedSlices
    }

    case 'zero-payload-structural': {
    const pmFrom = pmStart
    const pmToExclusive = pmStart + 1
    const structuralSlices = Object.freeze([
      Object.freeze({
        semanticFrom: 0,
        semanticTo: 1,
        markdownFrom: raw.markdownFrom,
        markdownTo: raw.markdownFrom,
        kind: 'text' as const,
        pmFrom,
        pmToExclusive,
      }),
    ])
    if (import.meta.env.DEV) {
      assertSemanticSlicesCoverSemanticSpace(structuralSlices, semanticExtent, canonicalBuffer, {
        ...assertionCtxBase,
      })
      assertSemanticTokenDeterminism(structuralSlices, semanticExtent, canonicalBuffer, {
        ...assertionCtxBase,
      })
      assertNoSemanticFallback({
        blockIndex,
        rowKey: `legacy:${blockIndex}`,
        blockPath: freezeModeSwitchLeafPath([blockIndex]),
        blockType: node.type.name,
        cmStart: structuralSlices[0]!.markdownFrom,
        cmEnd: structuralSlices[0]!.markdownTo,
        pmStart,
        pmEnd: _pmEnd,
        semanticExtent,
        semanticSlices: structuralSlices,
      })
    }
    return structuralSlices
    }

    case 'inline-zip': {
      const seg = canonicalBuffer.slice(raw.bodyFrom, raw.bodyTo)
      const frozen = compileInlineSemanticSlices({
        node,
        seg,
        segmentBase: raw.bodyFrom,
        pmInnerStart: pmStart,
        semanticExtent,
        blockIndex,
        rowKey,
        canonicalBuffer,
        stripLinePrefixes: raw.stripLinePrefixes,
        collapseSoftLineBreaks: raw.collapseSoftLineBreaks,
      })
      if (import.meta.env.DEV) {
        assertSemanticSlicesCoverSemanticSpace(frozen, semanticExtent, canonicalBuffer, {
          ...assertionCtxBase,
        })
        assertSemanticTokenDeterminism(frozen, semanticExtent, canonicalBuffer, {
          ...assertionCtxBase,
        })
        assertNoSemanticFallback({
          blockIndex,
          rowKey: `legacy:${blockIndex}`,
          blockPath: freezeModeSwitchLeafPath([blockIndex]),
          blockType: node.type.name,
          cmStart: frozen[0]!.markdownFrom,
          cmEnd: frozen[frozen.length - 1]!.markdownTo,
          pmStart,
          pmEnd: _pmEnd,
          semanticExtent,
          semanticSlices: frozen,
        })
      }
      return frozen
    }
  }
}

function validateFreezeGeometryVsHierarchical(
  canonicalBuffer: string,
  hierarchical: ModeSwitchFrozenHierarchicalRef,
  blockCount: number,
): void {
  if (!import.meta.env.DEV || !hierarchical || blockCount <= 0) return
  if (hierarchical.bufferHash.length > 0 && hierarchical.bufferHash !== modeSwitchPlainTextFingerprint(canonicalBuffer)) {
     
    console.warn('[mode-switch] freeze: hierarchical.bufferHash !== canonical fingerprint')
  }
  const maxBi = Math.max(hierarchical.anchor.blockIndex, hierarchical.head.blockIndex)
  if (maxBi >= blockCount) {
     
    console.warn('[mode-switch] freeze: hierarchical blockIndex out of IR row range', { maxBi, blockCount })
  }
}

type MarkdownLeafSeg = RawSeg & {
  readonly blockType: string
}

function lineOffset(starts: readonly number[], line: number): number {
  const idx = Math.max(0, Math.min(line, starts.length - 1))
  return starts[idx] ?? 0
}

function stackHasStructuredPrefix(stack: readonly string[]): boolean {
  return stack.some(
    (tokenType) =>
      tokenType === 'blockquote_open' ||
      tokenType === 'callout_open' ||
      tokenType === 'dd_open' ||
      tokenType === 'bullet_list_open' ||
      tokenType === 'ordered_list_open' ||
      tokenType === 'list_item_open',
  )
}

function isCalloutLeadLine(line: string): boolean {
  return /^\s*>\s*\[![^\]]+\]/.test(line)
}

function headingBodyOffsetWithContainerPrefixes(seg: string): number {
  let i = 0
  while (i < seg.length) {
    const skipped = skipListOrBlockquoteLinePrefix(seg, i)
    if (skipped <= 0) break
    i += skipped
  }
  while (i < seg.length && seg[i] === '#') i += 1
  while (i < seg.length && (seg[i] === ' ' || seg[i] === '\t')) i += 1
  return i
}

function calloutBodyOffsetInLine(seg: string): number {
  const m = seg.match(/^\s*>\s*\[!\s*[A-Z]+\s*\]\s*/iu)
  return m?.[0]?.length ?? 0
}

function fenceBodyRange(markdown: string, from: number, to: number): { bodyFrom: number; bodyTo: number } {
  const firstNl = markdown.indexOf('\n', from)
  if (firstNl < 0 || firstNl + 1 >= to) return { bodyFrom: to, bodyTo: to }
  let closingLineStart = to
  for (let i = to - 1; i >= from; i -= 1) {
    if (markdown[i] === '\n') {
      closingLineStart = i + 1
      break
    }
  }
  if (closingLineStart <= firstNl) closingLineStart = to
  return {
    bodyFrom: firstNl + 1,
    bodyTo: Math.max(firstNl + 1, closingLineStart),
  }
}

function mathBlockBodyRange(markdown: string, from: number, to: number): { bodyFrom: number; bodyTo: number } {
  const firstNl = markdown.indexOf('\n', from)
  if (firstNl < 0 || firstNl + 1 >= to) return { bodyFrom: to, bodyTo: to }
  let closingLineStart = to
  for (let i = to - 1; i >= from; i -= 1) {
    if (markdown[i] === '\n') {
      closingLineStart = i + 1
      break
    }
  }
  if (closingLineStart <= firstNl) closingLineStart = to
  let bodyTo = Math.max(firstNl + 1, closingLineStart)
  while (bodyTo > firstNl + 1 && markdown[bodyTo - 1] === '\n') bodyTo -= 1
  return { bodyFrom: firstNl + 1, bodyTo }
}

function lunaRawBodyRange(markdown: string, from: number, to: number): { bodyFrom: number; bodyTo: number } {
  const firstNl = markdown.indexOf('\n', from)
  if (firstNl < 0 || firstNl + 1 >= to) return { bodyFrom: to, bodyTo: to }
  let bodyFrom = firstNl + 1
  const secondNl = markdown.indexOf('\n', bodyFrom)
  if (secondNl > bodyFrom) {
    const maybeSource = markdown.slice(bodyFrom, secondNl).replace(/\r$/u, '')
    if (/^\s*source:\s*(html|unknown|invalid)\s*$/iu.test(maybeSource)) {
      bodyFrom = secondNl + 1
    }
  }
  let closingLineStart = to
  for (let i = to - 1; i >= from; i -= 1) {
    if (markdown[i] === '\n') {
      closingLineStart = i + 1
      break
    }
  }
  if (closingLineStart <= bodyFrom) closingLineStart = to
  let bodyTo = Math.max(bodyFrom, closingLineStart)
  while (bodyTo > bodyFrom && markdown[bodyTo - 1] === '\n') bodyTo -= 1
  return { bodyFrom, bodyTo }
}

function buildBlankParagraphRows(
  canonicalBuffer: string,
  tokens: readonly MdItTokenLike[],
): readonly MarkdownLeafSeg[] {
  const lineStarts = buildLineStartOffsets(canonicalBuffer)
  const lineOffsetAt = (line: number): number => lineOffset(lineStarts, line)
  const ranges = extractTopLevelBlockRangesFromTokens(tokens)
  const blanks: MarkdownLeafSeg[] = []

  const pushBlank = (pos: number) => {
    blanks.push({
      markdownFrom: pos,
      markdownTo: pos,
      bodyFrom: pos,
      bodyTo: pos,
      blockType: 'paragraph',
    })
  }

  if (!ranges.length) {
    if (canonicalBuffer.length === 0) {
      pushBlank(0)
      return Object.freeze(blanks)
    }
    const lines = canonicalBuffer.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if ((lines[i] ?? '').trim() !== '') continue
      pushBlank(lineOffsetAt(i))
    }
    if (!blanks.length) pushBlank(0)
    return Object.freeze(blanks)
  }

  const leading = Math.max(0, ranges[0]?.start ?? 0)
  for (let i = 0; i < leading; i += 1) {
    pushBlank(lineOffsetAt(i))
  }

  for (let i = 0; i < ranges.length - 1; i += 1) {
    const prev = ranges[i]!
    const next = ranges[i + 1]!
    const rawRun = Math.max(0, next.start - prev.end)
    const visibleBlankCount = Math.max(0, rawRun - 1)
    for (let blank = 0; blank < visibleBlankCount; blank += 1) {
      pushBlank(lineOffsetAt(prev.end + 1 + blank))
    }
  }

  const lines = canonicalBuffer.split('\n')
  const trailingRun = Math.max(0, lines.length - (ranges[ranges.length - 1]?.end ?? 0))
  const trailingVisibleCount = countVisibleTrailingBlankSegments(canonicalBuffer, trailingRun)
  const trailingStartLine = lines.length - trailingVisibleCount
  for (let i = 0; i < trailingVisibleCount; i += 1) {
    pushBlank(lineOffsetAt(trailingStartLine + i))
  }

  return Object.freeze(blanks)
}

function extractLeafMarkdownSegments(canonicalBuffer: string): readonly MarkdownLeafSeg[] {
  const tokens = modeSwitchIrMarkdownIt.parse(canonicalBuffer, {}) as MdItTokenLike[]
  const lineStarts = buildLineStartOffsets(canonicalBuffer)
  const rows: MarkdownLeafSeg[] = []
  const stack: string[] = []

  for (const token of tokens) {
    const map = Array.isArray(token.map) ? token.map : null
    const startLine = map?.[0]
    const endLine = map?.[1]
    const markdownFrom =
      typeof startLine === 'number' && Number.isFinite(startLine) ? lineOffset(lineStarts, startLine) : 0
    const markdownTo =
      typeof endLine === 'number' && Number.isFinite(endLine) ? lineOffset(lineStarts, endLine) : markdownFrom
    const lineText = canonicalBuffer.slice(markdownFrom, markdownTo)
    const effectiveType =
      token.type === 'blockquote_open' && isCalloutLeadLine(lineText) ? 'callout_open' : token.type

    if (map) {
      if (token.type === 'heading_open') {
        const bodyFrom = markdownFrom + headingBodyOffsetWithContainerPrefixes(lineText)
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom,
          bodyTo: markdownTo,
          blockType: 'heading',
        })
      } else if (token.type === 'paragraph_open') {
        const trimmed = lineText.trim()
        const calloutBodyOffset = stack.includes('callout_open') ? calloutBodyOffsetInLine(lineText) : 0
        const row = {
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom + calloutBodyOffset,
          bodyTo: markdownTo,
          stripLinePrefixes: stackHasStructuredPrefix(stack),
          collapseSoftLineBreaks: stackHasStructuredPrefix(stack),
          blockType: /^\[toc\]\s*$/i.test(trimmed) ? 'tocDirective' : 'paragraph',
        } satisfies MarkdownLeafSeg
        if (!(stack.includes('callout_open') && row.bodyFrom >= row.bodyTo)) {
          rows.push(row)
        }
      } else if (token.type === 'dt_open') {
        rows.push({
          markdownFrom,
          markdownTo: lineOffset(lineStarts, Math.max((startLine ?? 0) + 1, endLine ?? 0)),
          bodyFrom: markdownFrom,
          bodyTo: lineOffset(lineStarts, Math.max((startLine ?? 0) + 1, endLine ?? 0)),
          blockType: 'definitionTerm',
        })
      } else if (token.type === 'fence' || token.type === 'code_block') {
        const body = token.type === 'fence' ? fenceBodyRange(canonicalBuffer, markdownFrom, markdownTo) : {
          bodyFrom: markdownFrom,
          bodyTo: markdownTo,
        }
        const info = typeof token.info === 'string' ? token.info.trim() : ''
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: body.bodyFrom,
          bodyTo: body.bodyTo,
          blockType: info.startsWith('mermaid')
            ? 'mermaidBlock'
            : info.startsWith('luna-raw')
              ? 'rawBlock'
              : 'codeBlock',
          source: info.startsWith('luna-raw') ? 'unknown' : undefined,
        })
      } else if (token.type === 'luna_raw_block') {
        const body = lunaRawBodyRange(canonicalBuffer, markdownFrom, markdownTo)
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: body.bodyFrom,
          bodyTo: body.bodyTo,
          blockType: 'rawBlock',
          source: tokenAttr(token, 'source') ?? 'unknown',
        })
      } else if (token.type === 'math_block' || token.type === 'math_block_eqno') {
        const body = mathBlockBodyRange(canonicalBuffer, markdownFrom, markdownTo)
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: body.bodyFrom,
          bodyTo: body.bodyTo,
          blockType: 'blockMath',
        })
      } else if (token.type === 'footnote_def') {
        const bodyFrom = markdownFrom + footnoteBodyMinIndexInSeg(lineText)
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom,
          bodyTo: markdownTo,
          blockType: 'footnoteDef',
        })
      } else if (token.type === 'link_reference_def') {
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom,
          bodyTo: markdownTo,
          blockType: 'linkReferenceDef',
        })
      } else if (token.type === 'toc_directive') {
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom,
          bodyTo: markdownTo,
          blockType: 'tocDirective',
        })
      } else if (token.type === 'html_block') {
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom,
          bodyTo: markdownTo,
          blockType: 'rawBlock',
          source: 'html',
        })
      } else if (token.type === 'hr') {
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom,
          bodyTo: markdownFrom,
          blockType: 'horizontalRule',
        })
      } else if (token.type === 'table_open') {
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom: markdownFrom,
          bodyTo: markdownTo,
          blockType: 'table',
        })
      }
    }

    if (token.nesting === 1) {
      stack.push(effectiveType)
    } else if (token.nesting === -1) {
      if (token.type === 'blockquote_close') {
        const idx = Math.max(stack.lastIndexOf('callout_open'), stack.lastIndexOf('blockquote_open'))
        if (idx >= 0) stack.splice(idx, 1)
      } else {
        const openType = token.type.replace(/_close$/, '_open')
        const idx = stack.lastIndexOf(openType)
        if (idx >= 0) stack.splice(idx, 1)
      }
    }
  }

  const blankRows = buildBlankParagraphRows(canonicalBuffer, tokens)
  rows.push(...blankRows)
  rows.sort((a, b) => {
    if (a.markdownFrom !== b.markdownFrom) return a.markdownFrom - b.markdownFrom
    if (a.markdownTo !== b.markdownTo) return a.markdownTo - b.markdownTo
    if (a.bodyFrom !== b.bodyFrom) return a.bodyFrom - b.bodyFrom
    return a.bodyTo - b.bodyTo
  })
  return Object.freeze(rows.map((row) => Object.freeze(row)))
}

type CollapsedAtomSemanticTextReader = (node: PMNode) => string

const COLLAPSED_ATOM_SEMANTIC_TEXT_READERS: Readonly<Record<string, CollapsedAtomSemanticTextReader>> = Object.freeze({
  rawBlock: (node) => String((node.attrs as { content?: string } | null | undefined)?.content ?? ''),
  mermaidBlock: (node) => String((node.attrs as { source?: string } | null | undefined)?.source ?? ''),
  blockMath: (node) => String((node.attrs as { latex?: string } | null | undefined)?.latex ?? ''),
  linkReferenceDef: (node) => {
    const attrs =
      (node.attrs as { label?: string; href?: string; title?: string | null } | null | undefined) ?? {}
    return formatLinkReferenceDefLine(attrs.label ?? '', attrs.href ?? '', attrs.title ?? null)
  },
  tocDirective: () => '[toc]',
})

function readCollapsedAtomSemanticText(node: PMNode): string | null {
  const reader = COLLAPSED_ATOM_SEMANTIC_TEXT_READERS[node.type.name]
  return reader ? reader(node) : null
}

function semanticExtentForRow(node: PMNode, raw: RawSeg): number {
  // Structural core decides the minimum semantic surface that projection can rely on.
  // Precision adapters may later refine slice boundaries, but should not change the
  // row-level contract established here.
  const collapsedSemanticText = readCollapsedAtomSemanticText(node)
  const semanticBuildPath = getModeSwitchSemanticBuildPath(node.type.name)
  const textLen = textLenFullInBlock(node)
  return collapsedSemanticText != null
    ? Math.max(1, collapsedSemanticText.length)
    : semanticBuildPath === 'collapsed-atom-carrier'
      ? Math.max(1, raw.bodyTo - raw.bodyFrom)
    : semanticBuildPath === 'zero-payload-structural'
      ? 0
      : textLen === 0 && raw.bodyFrom === raw.bodyTo
        ? 0
        : Math.max(1, textLen)
}

function isCompatibleLeafRowType(pmType: string, mdType: string): boolean {
  if (pmType === mdType) return true
  if (pmType === 'mermaidBlock' && mdType === 'codeBlock') return true
  if (pmType === 'paragraph' && mdType === 'tocDirective') return false
  return false
}

function buildLeafFrozenStructuralIR(args: {
  canonicalBuffer: string
  hierarchical: ModeSwitchFrozenHierarchicalRef
  doc: PMNode
}): FrozenStructuralIR {
  const pmRows = collectProjectablePmLeafRows(args.doc)
  const mdRows = extractLeafMarkdownSegments(args.canonicalBuffer)

  if (!pmRows.length || pmRows.length !== mdRows.length) {
    throw new ModeSwitchFreezeError('[mode-switch] leaf IR row count mismatch', {
      reason: 'leaf_row_count_mismatch',
      pmRowCount: pmRows.length,
      mdRowCount: mdRows.length,
      pmRows: pmRows.map((row, index) => ({
        index,
        rowKey: row.rowKey,
        blockType: row.blockType,
        blockPath: row.blockPath.join('.'),
      })),
      mdRows: mdRows.map((row, index) => ({
        index,
        blockType: row.blockType,
        markdownFrom: row.markdownFrom,
        markdownTo: row.markdownTo,
        bodyFrom: row.bodyFrom,
        bodyTo: row.bodyTo,
      })),
    })
  }

  validateFreezeGeometryVsHierarchical(args.canonicalBuffer, args.hierarchical, pmRows.length)

  const blocks: FrozenGeometryRow[] = []
  for (let i = 0; i < pmRows.length; i += 1) {
    const pmRow = pmRows[i]!
    const mdRow = mdRows[i]!
    if (!isCompatibleLeafRowType(pmRow.blockType, mdRow.blockType)) {
      throw new ModeSwitchFreezeError('[mode-switch] leaf IR row type mismatch', {
        reason: 'leaf_row_type_mismatch',
        blockIndex: i,
        rowKey: pmRow.rowKey,
        pmType: pmRow.blockType,
        mdType: mdRow.blockType,
      })
    }
    const semanticExtent = semanticExtentForRow(pmRow.node, mdRow)
    const semanticSlices = buildSemanticSlicesForBlock({
      node: pmRow.node,
      raw: mdRow,
      canonicalBuffer: args.canonicalBuffer,
      semanticExtent,
      pmStart: pmRow.pmStart,
      pmEnd: pmRow.pmEnd,
      blockIndex: i,
      rowKey: pmRow.rowKey,
    })
    const firstSl = semanticSlices[0]!
    const lastSl = semanticSlices[semanticSlices.length - 1]!
    blocks.push(
      Object.freeze({
        blockIndex: i,
        rowKey: pmRow.rowKey,
        blockPath: pmRow.blockPath,
        blockType: pmRow.blockType,
        cmStart: firstSl.markdownFrom,
        cmEnd: lastSl.markdownTo,
        pmStart: pmRow.pmStart,
        pmEnd: pmRow.pmEnd,
        semanticExtent,
        semanticSlices,
      }),
    )
  }

  return Object.freeze({
    canonicalFingerprint: modeSwitchPlainTextFingerprint(args.canonicalBuffer),
    blocks: Object.freeze(blocks),
  })
}

/** Freeze-only kernel compile: mode switch geometry is now defined entirely in leaf-row space. */
export function buildFrozenStructuralIR(args: {
  canonicalBuffer: string
  hierarchical: ModeSwitchFrozenHierarchicalRef
  doc: PMNode
}): FrozenStructuralIR {
  return buildLeafFrozenStructuralIR(args)
}
