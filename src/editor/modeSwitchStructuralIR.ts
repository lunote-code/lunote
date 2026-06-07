import type { Node as PMNode } from 'prosemirror-model'

import {
  collectProjectablePmLeafRows,
  freezeModeSwitchLeafPath,
} from './modeSwitchLeafRow'
import { normalizeWikiLinkBlockRefEscapesInMarkdown } from './knowledgeRuntime/wikiLinkParser'
import {
  isModeSwitchAtomicContainerBlock,
  isModeSwitchCollapsedAtomCarrierBlock,
  isModeSwitchFenceLikeBlock,
  isModeSwitchZeroPayloadStructuralBlock,
} from './modeSwitchBlockGeometry'
import { effectiveTopLevelBlockEndLine } from './liftBlankLineParagraphs'
import { ModeSwitchFreezeError } from './modeSwitchFreezeFailure'
import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import { formatLinkReferenceDefLine } from './lunaLinkReferenceDef'
import { buildCanonicalLeafIR } from './modeSwitchCanonicalLeafIR'
import {
  modeSwitchIrMarkdownIt,
  tokenAttr,
  tokenizeMarkdownInlineViaMdIt,
  type MdItTokenLike,
} from './modeSwitchIrMarkdownIt'
import {
  bindPmToCanonicalRows,
  buildFrozenRowsFromCanonicalAndPmBinding,
} from './modeSwitchPmBinding'
import {
  buildAtomicContainerSemanticSlices,
  buildCollapsedAtomCarrierSemanticSlices,
  buildFenceSemanticSlices,
  buildZeroPayloadStructuralSemanticSlices,
} from './modeSwitchStructuralBlockBuilders'
import {
  collectPmSemanticTokens,
  footnoteBodyMinIndexInSeg,
  headingBodyMinIndexForLevel,
  shouldSkipLinePrefixesForNode,
  structuredLineBodyMinIndexInSeg,
  syntaxAwareMinIndexInSeg,
  tokenizeMarkdownBodyToSemanticTokens,
  tokenizeMarkdownTableBodyToSemanticTokens,
  tokenizeStructuredLinewiseMarkdownBody,
  tokenizeWholeBodyAsPlainText,
} from './modeSwitchSemanticTokenizer'
import {
  type MdSemTok,
  mergeAdjacentPmTokens,
  type PmSemTok,
  repartitionPmTokensToMatchMd,
  zipPmMdSemanticTokens,
} from './modeSwitchSemanticZip'
import {
  assertNoSemanticFallback,
  assertSemanticSlicesCoverSemanticSpace,
  assertSemanticTokenDeterminism,
  assertStrictSemanticTokenParity,
} from './modeSwitchStructuralIRInvariants'
import type {
  CollapsedAtomSemanticTextReader,
  FrozenGeometryRow,
  FrozenStructuralIR,
  ModeSwitchFrozenHierarchicalRef,
  ModeSwitchSemanticBuildLayer,
  ModeSwitchSemanticBuildPath,
  SemanticSlice,
} from './modeSwitchStructuralIRTypes'

export type {
  FrozenGeometryRow,
  FrozenStructuralIR,
  ModeSwitchFrozenHierarchicalRef,
  SemanticSlice,
  SemanticSliceKind,
  SemanticTokenizationError,
} from './modeSwitchStructuralIRTypes'

export {
  assertNoSemanticFallback,
  assertSemanticSlicesCoverSemanticSpace,
  assertSemanticTokenDeterminism,
  assertStrictSemanticTokenParity,
} from './modeSwitchStructuralIRInvariants'

/*═══ PRIVATE FREEZE-ONLY PRECOMPILER — scan logic must not be exported / must not be projected / viewport / runtime path import ═══*/

function textLenFullInBlock(block: PMNode): number {
  const r = block.content.size
  try {
    return block.textBetween(0, r, '\n', '\n').length
  } catch {
    return 0
  }
}

function computePmSemanticTokenTextLength(node: PMNode): number {
  const toks = collectPmSemanticTokens(node, 0) ?? []
  let len = 0
  for (const tok of toks) len += tok.text.length
  return len
}

function getModeSwitchSemanticBuildPath(typeName: string): ModeSwitchSemanticBuildPath {
  if (isModeSwitchFenceLikeBlock(typeName)) return 'fence'
  if (isModeSwitchAtomicContainerBlock(typeName)) return 'atomic-container'
  if (isModeSwitchCollapsedAtomCarrierBlock(typeName)) return 'collapsed-atom-carrier'
  if (isModeSwitchZeroPayloadStructuralBlock(typeName)) return 'zero-payload-structural'
  return 'inline-zip'
}

function getModeSwitchSemanticBuildLayer(
  buildPath: ModeSwitchSemanticBuildPath,
): ModeSwitchSemanticBuildLayer {
  switch (buildPath) {
    case 'atomic-container':
    case 'collapsed-atom-carrier':
    case 'zero-payload-structural':
      return 'structural_core'
    case 'fence':
    case 'inline-zip':
      return 'precision_adapter'
  }
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

type BlockLineRange = {
  start: number
  end: number
  type: string
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
  stripTaskMarkers?: boolean
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
    stripTaskMarkers,
    collapseSoftLineBreaks,
  } = args
  const bodyRel = syntaxAwareMinIndexInSeg(seg, node, { stripTaskMarkers })
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
    ? tokenizeStructuredLinewiseMarkdownBody(
        bodySeg,
        baseAbs,
        'text',
        collapseSoftLineBreaks ?? false,
        stripTaskMarkers ?? false,
      )
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
            stripTaskMarkers ?? false,
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
    const tryZipWithMarkdownItInline = (seg: string) => {
      const mdItTok = tokenizeMarkdownInlineViaMdIt(seg, baseAbs, 'text')
      if (mdItTok == null) return null
      const zipped = zipPmMdSemanticTokens(pmTok, mdItTok, semanticExtent)
      if (zipped != null) return { pmTok, mdTok: mdItTok, zipped }
      const repartitionedPmTok = repartitionPmTokensToMatchMd(pmTok, mdItTok)
      if (repartitionedPmTok == null) return null
      const repartitionedZip = zipPmMdSemanticTokens(repartitionedPmTok, mdItTok, semanticExtent)
      if (repartitionedZip == null) return null
      return { pmTok: repartitionedPmTok, mdTok: mdItTok, zipped: repartitionedZip }
    }
    const mdItBody = tryZipWithMarkdownItInline(bodySeg)
    if (mdItBody != null) return mdItBody
    if (trimmedTerminalNewline != null) {
      const mdItTrimmed = tryZipWithMarkdownItInline(trimmedTerminalNewline)
      if (mdItTrimmed != null) return mdItTrimmed
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

function buildSemanticSlicesForBlock(args: {
  node: PMNode
  raw: RawSeg
  canonicalBuffer: string
  semanticExtent: number
  pmStart: number
  pmEnd: number
  blockIndex: number
  rowKey?: string
  stripTaskMarkers?: boolean
}): readonly SemanticSlice[] {
  const {
    node,
    raw,
    canonicalBuffer,
    semanticExtent,
    pmStart,
    pmEnd: _pmEnd,
    blockIndex,
    rowKey,
    stripTaskMarkers,
  } = args
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

  // Structural core only guarantees stable leaf rows, block geometry, and conservative
  // semantic extents. Precision adapters are the only layer allowed to spend effort on
  // token-by-token markdown payload alignment.
  switch (semanticBuildPath) {
    case 'fence': {
      return buildFenceSemanticSlices({
        node,
        raw,
        canonicalBuffer,
        semanticExtent,
        pmStart,
        pmEnd: _pmEnd,
        blockIndex,
        assertionCtxBase,
      })
    }

    case 'atomic-container': {
      return buildAtomicContainerSemanticSlices({
        node,
        raw,
        canonicalBuffer,
        semanticExtent,
        pmStart,
        blockIndex,
        rowKey,
        tokenizeMarkdownTableBodyToSemanticTokens,
        throwStrictSemanticCompileFailure,
      })
    }

    case 'collapsed-atom-carrier': {
      return buildCollapsedAtomCarrierSemanticSlices({
        node,
        raw,
        canonicalBuffer,
        semanticExtent,
        pmStart,
        pmEnd: _pmEnd,
        blockIndex,
        assertionCtxBase,
      })
    }

    case 'zero-payload-structural': {
      return buildZeroPayloadStructuralSemanticSlices({
        node,
        raw,
        canonicalBuffer,
        semanticExtent,
        pmStart,
        pmEnd: _pmEnd,
        blockIndex,
        assertionCtxBase,
      })
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
        stripTaskMarkers,
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
          rowId: `legacy:${blockIndex}`,
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

function shouldCollapseStructuredSoftLineBreaks(stack: readonly string[]): boolean {
  if (stack.includes('callout_open')) return false
  if (stack.includes('blockquote_open')) return false
  return stack.some(
    (tokenType) =>
      tokenType === 'dd_open' ||
      tokenType === 'bullet_list_open' ||
      tokenType === 'ordered_list_open' ||
      tokenType === 'list_item_open',
  )
}

function isCalloutLeadLine(line: string): boolean {
  return /^\s*>\s*\[![^\]]+\]/.test(line)
}

function calloutBodyOffsetInLine(seg: string): number {
  return structuredLineBodyMinIndexInSeg(seg, {
    stripTaskMarkers: false,
    includeCalloutMarker: true,
  })
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

function trimTrailingPlainBlankLines(markdown: string, from: number, to: number): number {
  let end = to
  while (end > from) {
    let lineEnd = end
    if (lineEnd > from && markdown[lineEnd - 1] === '\n') lineEnd -= 1
    if (lineEnd <= from) {
      end = from
      break
    }
    let lineStart = lineEnd
    while (lineStart > from && markdown[lineStart - 1] !== '\n') lineStart -= 1
    const line = markdown.slice(lineStart, lineEnd)
    if (line.trim().length > 0) break
    end = lineStart
  }
  return end
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
    const prevEnd = effectiveTopLevelBlockEndLine(canonicalBuffer, prev)
    const rawRun = Math.max(0, next.start - prevEnd)
    const visibleBlankCount = Math.max(0, rawRun - 1)
    for (let blank = 0; blank < visibleBlankCount; blank += 1) {
      pushBlank(lineOffsetAt(prevEnd + 1 + blank))
    }
  }

  const lines = canonicalBuffer.split('\n')
  const last = ranges[ranges.length - 1]!
  const trailingRun = Math.max(0, lines.length - effectiveTopLevelBlockEndLine(canonicalBuffer, last))
  const trailingVisibleCount = countVisibleTrailingBlankSegments(canonicalBuffer, trailingRun)
  const trailingStartLine = lines.length - trailingVisibleCount
  for (let i = 0; i < trailingVisibleCount; i += 1) {
    pushBlank(lineOffsetAt(trailingStartLine + i))
  }

  return Object.freeze(blanks)
}

function buildLeadingBlankCalloutRows(
  canonicalBuffer: string,
  lineStarts: readonly number[],
  startLine: number,
  endLine: number,
): readonly MarkdownLeafSeg[] {
  const rows: MarkdownLeafSeg[] = []
  for (let line = startLine + 1; line < endLine; line += 1) {
    const lineFrom = lineOffset(lineStarts, line)
    const lineTo = lineOffset(lineStarts, line + 1)
    const rawLine = canonicalBuffer.slice(lineFrom, Math.max(lineFrom, lineTo - 1))
    if (!/^\s*>/u.test(rawLine)) break
    const bodyOffset = structuredLineBodyMinIndexInSeg(rawLine, {
      stripTaskMarkers: false,
      includeCalloutMarker: false,
    })
    const bodyText = rawLine.slice(Math.min(rawLine.length, bodyOffset))
    if (bodyText.trim().length > 0) break
    const bodyPos = Math.min(lineFrom + bodyOffset, lineTo)
    rows.push({
      markdownFrom: lineFrom,
      markdownTo: bodyPos,
      bodyFrom: bodyPos,
      bodyTo: bodyPos,
      stripLinePrefixes: true,
      collapseSoftLineBreaks: false,
      blockType: 'paragraph',
    })
  }
  return Object.freeze(rows)
}

export function extractLeafMarkdownSegments(
  canonicalBuffer: string,
  options: { onDetail?: (line: string) => void } = {},
): readonly MarkdownLeafSeg[] {
  options.onDetail?.('extractLeafMarkdownSegments.parseMarkdownIt')
  const tokens = modeSwitchIrMarkdownIt.parse(canonicalBuffer, {}) as MdItTokenLike[]
  options.onDetail?.('extractLeafMarkdownSegments.walkTokens')
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
        const level = Number(token.tag?.slice(1)) || 1
        const bodyFrom = markdownFrom + headingBodyMinIndexForLevel(lineText, level)
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
        const stripPrefixes = stackHasStructuredPrefix(stack)
        const trimmedMarkdownTo = trimTrailingPlainBlankLines(canonicalBuffer, markdownFrom, markdownTo)
        const row = {
          markdownFrom,
          markdownTo: trimmedMarkdownTo,
          bodyFrom: markdownFrom + calloutBodyOffset,
          bodyTo: trimmedMarkdownTo,
          stripLinePrefixes: stripPrefixes,
          collapseSoftLineBreaks: shouldCollapseStructuredSoftLineBreaks(stack),
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
        const content = typeof token.content === 'string' ? token.content : ''
        rows.push({
          markdownFrom,
          markdownTo,
          bodyFrom,
          bodyTo: Math.min(markdownTo, bodyFrom + content.length),
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
      } else if (effectiveType === 'callout_open' && typeof startLine === 'number' && typeof endLine === 'number') {
        rows.push(...buildLeadingBlankCalloutRows(canonicalBuffer, lineStarts, startLine, endLine))
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

  options.onDetail?.('extractLeafMarkdownSegments.afterWalkTokens')
  const blankRows = buildBlankParagraphRows(canonicalBuffer, tokens)
  options.onDetail?.('extractLeafMarkdownSegments.afterBuildBlankParagraphRows')
  rows.push(...blankRows)
  rows.sort((a, b) => {
    if (a.markdownFrom !== b.markdownFrom) return a.markdownFrom - b.markdownFrom
    if (a.markdownTo !== b.markdownTo) return a.markdownTo - b.markdownTo
    if (a.bodyFrom !== b.bodyFrom) return a.bodyFrom - b.bodyFrom
    return a.bodyTo - b.bodyTo
  })
  options.onDetail?.('extractLeafMarkdownSegments.afterSort')
  return Object.freeze(rows.map((row) => Object.freeze(row)))
}

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
  const semanticTokenTextLen = computePmSemanticTokenTextLength(node)
  return collapsedSemanticText != null
    ? Math.max(1, collapsedSemanticText.length)
    : semanticBuildPath === 'atomic-container'
      ? computePmSemanticTokenTextLength(node)
    : semanticBuildPath === 'collapsed-atom-carrier'
      ? Math.max(1, raw.bodyTo - raw.bodyFrom)
    : semanticBuildPath === 'zero-payload-structural'
      ? 0
      : (semanticTokenTextLen > 0 ? semanticTokenTextLen : textLen) === 0 && raw.bodyFrom === raw.bodyTo
        ? 0
        : Math.max(1, semanticTokenTextLen > 0 ? semanticTokenTextLen : textLen)
}

type PmLeafRow = ReturnType<typeof collectProjectablePmLeafRows>[number]

function isEmptyMdLeafRow(mdRow: MarkdownLeafSeg): boolean {
  return mdRow.bodyFrom === mdRow.bodyTo
}

function pmRowIsStandaloneTocParagraph(pmRow: PmLeafRow): boolean {
  if (pmRow.blockType !== 'paragraph' || pmRow.node.type.name !== 'paragraph') return false
  const text = pmRow.node.textBetween(0, pmRow.node.content.size, '\n', '\n').trim()
  return /^\[toc\]$/iu.test(text)
}

function isCompatibleLeafRowType(pmRow: PmLeafRow, mdRow: MarkdownLeafSeg): boolean {
  const pmType = pmRow.blockType
  const mdType = mdRow.blockType
  if (pmType === mdType) return true
  if (pmType === 'mermaidBlock' && mdType === 'codeBlock') return true
  if (pmType === 'paragraph' && mdType === 'tocDirective') return pmRowIsStandaloneTocParagraph(pmRow)
  if (pmType === 'tocDirective' && mdType === 'paragraph' && isEmptyMdLeafRow(mdRow)) return false
  if (isSpuriousEmptyPmLeafRow(pmRow) && mdType === 'paragraph' && isEmptyMdLeafRow(mdRow)) return true
  if (
    pmType === 'heading' &&
    pmRow.node.type.name === 'heading' &&
    pmRow.node.content.size === 0 &&
    mdType === 'paragraph' &&
    isEmptyMdLeafRow(mdRow)
  ) {
    return true
  }
  if (
    pmType === 'paragraph' &&
    pmRow.node.content.size === 0 &&
    mdType === 'heading' &&
    isEmptyMdLeafRow(mdRow)
  ) {
    return true
  }
  return false
}

/** Zip PM rows to MD leaf segments by type; drops spurious empty PM rows between pairs. */
function alignPmRowsToMarkdownLeafSegments(
  pmRows: ReturnType<typeof collectProjectablePmLeafRows>,
  mdRows: readonly MarkdownLeafSeg[],
): ReturnType<typeof collectProjectablePmLeafRows> | null {
  if (!mdRows.length) {
    return pmRows.length === 0 ? pmRows : null
  }
  const aligned: PmLeafRow[] = []
  let pmIndex = 0
  for (let mdIndex = 0; mdIndex < mdRows.length; mdIndex += 1) {
    const mdRow = mdRows[mdIndex]!
    while (pmIndex < pmRows.length) {
      const candidate = pmRows[pmIndex]!
      if (isCompatibleLeafRowType(candidate, mdRow)) break
      if (!isSpuriousEmptyPmLeafRow(candidate)) return null
      pmIndex += 1
    }
    if (pmIndex >= pmRows.length) return null
    aligned.push(pmRows[pmIndex]!)
    pmIndex += 1
  }
  while (pmIndex < pmRows.length && isSpuriousEmptyPmLeafRow(pmRows[pmIndex])) pmIndex += 1
  if (pmIndex !== pmRows.length) return null
  return Object.freeze(aligned)
}

function isSpuriousEmptyPmLeafRow(row: ReturnType<typeof collectProjectablePmLeafRows>[number] | undefined): boolean {
  if (!row) return false
  if (row.blockType === 'paragraph' && row.node.type.name === 'paragraph' && row.node.content.size === 0) {
    return true
  }
  if (row.blockType === 'heading' && row.node.type.name === 'heading' && row.node.content.size === 0) {
    return true
  }
  return false
}

function trimSpuriousPmRowsToMdCount(
  pmRows: ReturnType<typeof collectProjectablePmLeafRows>,
  mdRows: readonly MarkdownLeafSeg[],
): ReturnType<typeof collectProjectablePmLeafRows> {
  if (!pmRows.length || pmRows.length <= mdRows.length) return pmRows
  let start = 0
  let end = pmRows.length
  while (end - start > mdRows.length && end > start && isSpuriousEmptyPmLeafRow(pmRows[end - 1])) {
    end -= 1
  }
  while (end - start > mdRows.length && end > start && isSpuriousEmptyPmLeafRow(pmRows[start])) {
    start += 1
  }
  if (start === 0 && end === pmRows.length) return pmRows
  return Object.freeze(pmRows.slice(start, end))
}

function normalizePmRowsForKnownParserArtifacts(
  pmRows: ReturnType<typeof collectProjectablePmLeafRows>,
  mdRows: readonly MarkdownLeafSeg[],
): ReturnType<typeof collectProjectablePmLeafRows> {
  pmRows = trimSpuriousPmRowsToMdCount(pmRows, mdRows)

  const isEmptyPmParagraph = (row: (typeof pmRows)[number] | undefined): boolean =>
    Boolean(row && row.blockType === 'paragraph' && row.node.type.name === 'paragraph' && row.node.content.size === 0)
  const isEmptyMdParagraph = (row: (typeof mdRows)[number] | undefined): boolean =>
    Boolean(row && row.blockType === 'paragraph' && row.bodyFrom === row.bodyTo)

  if (pmRows.length >= mdRows.length && mdRows.length > 0) {
    const normalized: typeof pmRows[number][] = []
    let pmIndex = 0
    let mdIndex = 0

    while (pmIndex < pmRows.length && mdIndex < mdRows.length) {
      const pmRow = pmRows[pmIndex]!
      const mdRow = mdRows[mdIndex]!
      if (isCompatibleLeafRowType(pmRow, mdRow)) {
        if (isEmptyPmParagraph(pmRow) && isEmptyMdParagraph(mdRow)) {
          let pmRunEnd = pmIndex
          while (pmRunEnd < pmRows.length && isEmptyPmParagraph(pmRows[pmRunEnd])) pmRunEnd += 1
          let mdRunEnd = mdIndex
          while (mdRunEnd < mdRows.length && isEmptyMdParagraph(mdRows[mdRunEnd])) mdRunEnd += 1
          const pmRunLen = pmRunEnd - pmIndex
          const mdRunLen = mdRunEnd - mdIndex
          if (pmRunLen < mdRunLen) return pmRows
          normalized.push(...pmRows.slice(pmIndex, pmIndex + mdRunLen))
          pmIndex = pmRunEnd
          mdIndex = mdRunEnd
          continue
        }
        normalized.push(pmRow)
        pmIndex += 1
        mdIndex += 1
        continue
      }

      if (isSpuriousEmptyPmLeafRow(pmRow)) {
        let skipEnd = pmIndex
        while (skipEnd < pmRows.length && isSpuriousEmptyPmLeafRow(pmRows[skipEnd])) skipEnd += 1
        if (
          skipEnd < pmRows.length &&
          isCompatibleLeafRowType(pmRows[skipEnd]!, mdRow)
        ) {
          pmIndex = skipEnd
          continue
        }
      }

      return pmRows
    }

    if (mdIndex === mdRows.length) {
      while (pmIndex < pmRows.length && isSpuriousEmptyPmLeafRow(pmRows[pmIndex])) pmIndex += 1
      if (pmIndex === pmRows.length && normalized.length === mdRows.length) {
        return Object.freeze(normalized)
      }
    }
  }

  const extraLeadingPmRows = pmRows.length - mdRows.length
  if (extraLeadingPmRows > 0 && mdRows.length > 0) {
    const leadingArtifactRows = pmRows.slice(0, extraLeadingPmRows)
    const artifactLooksLikeEmptyParagraphs = leadingArtifactRows.every((row) => isSpuriousEmptyPmLeafRow(row))
    const remainingPmRows = pmRows.slice(extraLeadingPmRows)
    const remainingRowsAlign =
      artifactLooksLikeEmptyParagraphs &&
      remainingPmRows.length === mdRows.length &&
      remainingPmRows.every((row, index) => isCompatibleLeafRowType(row, mdRows[index]!))
    if (remainingRowsAlign) return Object.freeze(remainingPmRows)
  }

  if (pmRows.length !== mdRows.length + 1 || !pmRows.length || !mdRows.length) return pmRows
  const trailingPm = pmRows[pmRows.length - 1]!
  const trailingMd = mdRows[mdRows.length - 1]!
  if (trailingMd.blockType === 'footnoteDef') {
    if (trailingPm.blockType !== 'paragraph' || trailingPm.node.type.name !== 'paragraph') return pmRows
    if (trailingPm.node.content.size > 0) return pmRows
    return Object.freeze(pmRows.slice(0, -1))
  }
  if (isSpuriousEmptyPmLeafRow(trailingPm)) {
    const trimmed = pmRows.slice(0, -1)
    if (
      trimmed.length === mdRows.length &&
      trimmed.every((row, index) => isCompatibleLeafRowType(row, mdRows[index]!))
    ) {
      return Object.freeze(trimmed)
    }
  }
  const aligned = alignPmRowsToMarkdownLeafSegments(pmRows, mdRows)
  if (aligned != null) return aligned
  return pmRows
}

export function buildLeafFrozenStructuralIR(args: {
  canonicalBuffer: string
  hierarchical: ModeSwitchFrozenHierarchicalRef
  doc: PMNode
  onDetail?: (line: string) => void
}): FrozenStructuralIR {
  args.onDetail?.('buildLeafFrozenStructuralIR.collectProjectablePmLeafRows')
  const rawPmRows = collectProjectablePmLeafRows(args.doc)
  args.onDetail?.('buildLeafFrozenStructuralIR.extractLeafMarkdownSegments')
  const mdRows = extractLeafMarkdownSegments(args.canonicalBuffer, { onDetail: args.onDetail })
  const pmRows = normalizePmRowsForKnownParserArtifacts(rawPmRows, mdRows)

  if (!pmRows.length || pmRows.length !== mdRows.length) {
    args.onDetail?.(
      `buildLeafFrozenStructuralIR.rowCountMismatch pm=${pmRows.length} md=${mdRows.length} pmRows=${JSON.stringify(
        pmRows.map((row, index) => ({
          index,
          rowKey: row.rowKey,
          blockType: row.blockType,
          withinTaskItem: row.withinTaskItem,
          blockPath: row.blockPath.join('.'),
        })),
      )} mdRows=${JSON.stringify(
        mdRows.map((row, index) => ({
          index,
          blockType: row.blockType,
          markdownFrom: row.markdownFrom,
          markdownTo: row.markdownTo,
          bodyFrom: row.bodyFrom,
          bodyTo: row.bodyTo,
        })),
      )}`,
    )
    throw new ModeSwitchFreezeError('[mode-switch] leaf IR row count mismatch', {
      reason: 'leaf_row_count_mismatch',
      pmRowCount: pmRows.length,
      mdRowCount: mdRows.length,
      canonicalLen: args.canonicalBuffer.length,
      canonicalExcerpt: args.canonicalBuffer.slice(0, 360),
      pmRows: pmRows.map((row, index) => ({
        index,
        rowKey: row.rowKey,
        blockType: row.blockType,
        withinTaskItem: row.withinTaskItem,
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
    if (!isCompatibleLeafRowType(pmRow, mdRow)) {
      throw new ModeSwitchFreezeError('[mode-switch] leaf IR row type mismatch', {
        reason: 'leaf_row_type_mismatch',
        blockIndex: i,
        rowKey: pmRow.rowKey,
        pmType: pmRow.blockType,
        mdType: mdRow.blockType,
        canonicalLen: args.canonicalBuffer.length,
        canonicalExcerpt: args.canonicalBuffer.slice(
          Math.max(0, mdRow.markdownFrom - 32),
          Math.min(args.canonicalBuffer.length, mdRow.markdownTo + 64),
        ),
        pmRows: pmRows.map((row, index) => ({
          index,
          blockType: row.blockType,
          rowKey: row.rowKey,
        })),
        mdRows: mdRows.map((row, index) => ({
          index,
          blockType: row.blockType,
          markdownFrom: row.markdownFrom,
          markdownTo: row.markdownTo,
        })),
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
      stripTaskMarkers: pmRow.withinTaskItem,
    })
    const firstSl = semanticSlices[0]!
    const lastSl = semanticSlices[semanticSlices.length - 1]!
    blocks.push(
      Object.freeze({
        blockIndex: i,
        rowId: `legacy-leaf:${i}`,
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
  onDetail?: (line: string) => void
}): FrozenStructuralIR {
  const canonicalBuffer = normalizeWikiLinkBlockRefEscapesInMarkdown(args.canonicalBuffer)
  args.onDetail?.('buildFrozenStructuralIR.extractLeafMarkdownSegments')
  const mdRows = extractLeafMarkdownSegments(canonicalBuffer, { onDetail: args.onDetail })
  args.onDetail?.('buildFrozenStructuralIR.buildCanonicalLeafIR')
  const canonicalIR = buildCanonicalLeafIR(canonicalBuffer, mdRows)
  args.onDetail?.('buildFrozenStructuralIR.bindPmToCanonicalRows')
  const binding = bindPmToCanonicalRows(args.doc, canonicalIR)
  const blocks = buildFrozenRowsFromCanonicalAndPmBinding(canonicalIR, binding)
  validateFreezeGeometryVsHierarchical(canonicalBuffer, args.hierarchical, blocks.length)
  return Object.freeze({
    canonicalFingerprint: canonicalIR.canonicalFingerprint,
    blocks,
  })
}
