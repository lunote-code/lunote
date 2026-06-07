import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import { tokenizeMarkdownInlineViaMdIt } from './modeSwitchIrMarkdownIt'
import {
  tokenizeMarkdownBodyToSemanticTokens,
  tokenizeMarkdownTableBodyToSemanticTokens,
  tokenizeStructuredLinewiseMarkdownBody,
} from './modeSwitchSemanticTokenizer'
import type { MdSemTok } from './modeSwitchSemanticZip'
import type { SemanticSliceKind } from './modeSwitchStructuralIRTypes'

export type CanonicalLeafInputRow = {
  readonly markdownFrom: number
  readonly markdownTo: number
  readonly bodyFrom: number
  readonly bodyTo: number
  readonly blockType: string
  readonly stripLinePrefixes?: boolean
  readonly collapseSoftLineBreaks?: boolean
  readonly source?: string
}

export type CanonicalSemanticSlice = {
  readonly semanticFrom: number
  readonly semanticTo: number
  readonly markdownFrom: number
  readonly markdownTo: number
  readonly kind: SemanticSliceKind
  readonly text: string
}

export type CanonicalLeafRow = CanonicalLeafInputRow & {
  readonly blockIndex: number
  readonly rowId: string
  readonly payloadFingerprint: string
  readonly semanticExtent: number
  readonly semanticSlices: readonly CanonicalSemanticSlice[]
}

export type CanonicalLeafIR = {
  readonly canonicalFingerprint: string
  readonly rows: readonly CanonicalLeafRow[]
}

function mdTokensToCanonicalSlices(tokens: readonly MdSemTok[]): readonly CanonicalSemanticSlice[] {
  const slices: CanonicalSemanticSlice[] = []
  let semanticBase = 0
  for (const token of tokens) {
    const length = token.text.length
    slices.push(
      Object.freeze({
        semanticFrom: semanticBase,
        semanticTo: semanticBase + length + 1,
        markdownFrom: token.markdownFrom,
        markdownTo: token.markdownTo,
        kind: token.kind,
        text: token.text,
      }),
    )
    semanticBase += length
  }
  return Object.freeze(slices)
}

function buildZeroWidthSlice(pos: number): readonly CanonicalSemanticSlice[] {
  return Object.freeze([
    Object.freeze({
      semanticFrom: 0,
      semanticTo: 1,
      markdownFrom: pos,
      markdownTo: pos,
      kind: 'text' as const,
      text: '',
    }),
  ])
}

function wholeBodyTokens(
  canonicalBuffer: string,
  from: number,
  to: number,
  kind: SemanticSliceKind,
): readonly MdSemTok[] {
  const text = canonicalBuffer.slice(from, to)
  if (!text.length) return []
  return Object.freeze([
    Object.freeze({
      text,
      kind,
      markdownFrom: from,
      markdownTo: to,
    }),
  ])
}

function buildMarkdownTokensForRow(
  row: CanonicalLeafInputRow,
  canonicalBuffer: string,
): readonly MdSemTok[] {
  if (row.blockType === 'horizontalRule') return []

  if (
    row.blockType === 'rawBlock' ||
    row.blockType === 'mermaidBlock' ||
    row.blockType === 'codeBlock' ||
    row.blockType === 'blockMath' ||
    row.blockType === 'linkReferenceDef' ||
    row.blockType === 'tocDirective'
  ) {
    const kind: SemanticSliceKind =
      row.blockType === 'rawBlock' && row.source === 'html' ? 'html' : 'text'
    const from = row.blockType === 'linkReferenceDef' || row.blockType === 'tocDirective'
      ? row.markdownFrom
      : row.bodyFrom
    const to = row.blockType === 'linkReferenceDef' || row.blockType === 'tocDirective'
      ? row.markdownTo
      : row.bodyTo
    return wholeBodyTokens(canonicalBuffer, from, to, kind)
  }

  if (row.blockType === 'table') {
    const tableTokens = tokenizeMarkdownTableBodyToSemanticTokens(
      canonicalBuffer.slice(row.markdownFrom, row.markdownTo),
      row.markdownFrom,
      'text',
    )
    return tableTokens ?? wholeBodyTokens(canonicalBuffer, row.markdownFrom, row.markdownTo, 'text')
  }

  const bodySeg = canonicalBuffer.slice(row.bodyFrom, row.bodyTo)
  if (!bodySeg.length) return []

  const structuredTokens =
    row.stripLinePrefixes
      ? tokenizeStructuredLinewiseMarkdownBody(
          bodySeg,
          row.bodyFrom,
          'text',
          row.collapseSoftLineBreaks ?? false,
          false,
        )
      : tokenizeMarkdownBodyToSemanticTokens(bodySeg, row.bodyFrom, 'text', false)
  if (structuredTokens != null) return structuredTokens

  const mdItTokens = tokenizeMarkdownInlineViaMdIt(bodySeg, row.bodyFrom, 'text')
  if (mdItTokens != null) return mdItTokens

  return wholeBodyTokens(canonicalBuffer, row.bodyFrom, row.bodyTo, 'text')
}

function buildCanonicalSemanticSlices(
  row: CanonicalLeafInputRow,
  canonicalBuffer: string,
): { semanticExtent: number; semanticSlices: readonly CanonicalSemanticSlice[] } {
  if (row.blockType === 'horizontalRule') {
    return Object.freeze({
      semanticExtent: 0,
      semanticSlices: buildZeroWidthSlice(row.bodyFrom),
    })
  }

  const tokens = buildMarkdownTokensForRow(row, canonicalBuffer)
  if (tokens.length === 0) {
    return Object.freeze({
      semanticExtent: 0,
      semanticSlices: buildZeroWidthSlice(row.bodyFrom),
    })
  }

  const semanticSlices = mdTokensToCanonicalSlices(tokens)
  const semanticExtent = semanticSlices.reduce((sum, slice) => sum + slice.text.length, 0)
  return Object.freeze({ semanticExtent, semanticSlices })
}

function canonicalLeafSignature(row: CanonicalLeafInputRow, canonicalBuffer: string): string {
  const markdown = canonicalBuffer.slice(row.markdownFrom, row.markdownTo)
  const payload = canonicalBuffer.slice(row.bodyFrom, row.bodyTo)
  return [
    row.blockType,
    modeSwitchPlainTextFingerprint(markdown),
    modeSwitchPlainTextFingerprint(payload),
  ].join(':')
}

export function buildCanonicalLeafIR(
  canonicalBuffer: string,
  rows: readonly CanonicalLeafInputRow[],
): CanonicalLeafIR {
  const signatureCounts = new Map<string, number>()
  const canonicalRows = rows.map((row, blockIndex) => {
    const signature = canonicalLeafSignature(row, canonicalBuffer)
    const occurrence = (signatureCounts.get(signature) ?? 0) + 1
    signatureCounts.set(signature, occurrence)
    const payloadFingerprint = modeSwitchPlainTextFingerprint(
      canonicalBuffer.slice(row.bodyFrom, row.bodyTo),
    )
    const semantic = buildCanonicalSemanticSlices(row, canonicalBuffer)
    return Object.freeze({
      ...row,
      blockIndex,
      rowId: `${signature}:${occurrence}`,
      payloadFingerprint,
      semanticExtent: semantic.semanticExtent,
      semanticSlices: semantic.semanticSlices,
    })
  })

  return Object.freeze({
    canonicalFingerprint: modeSwitchPlainTextFingerprint(canonicalBuffer),
    rows: Object.freeze(canonicalRows),
  })
}
