import type { Node as PMNode } from 'prosemirror-model'

import type { CanonicalLeafIR, CanonicalLeafRow, CanonicalSemanticSlice } from './modeSwitchCanonicalLeafIR'
import { collectProjectablePmLeafRows, type ModeSwitchPmLeafRow } from './modeSwitchLeafRow'
import { collectPmSemanticTokens } from './modeSwitchSemanticTokenizer'
import {
  mergeAdjacentPmTokens,
  repartitionPmTokensToMatchMd,
  zipPmMdSemanticTokens,
} from './modeSwitchSemanticZip'
import type { FrozenGeometryRow, SemanticSlice } from './modeSwitchStructuralIRTypes'

export type PmBindingResolution =
  | 'compatible'
  | 'skip_spurious'
  | 'fallback_nearest'
  | 'synthetic_last'

export type PmBoundLeafRow = {
  readonly canonicalRowId: string
  readonly canonicalBlockType: string
  readonly rowKey: string
  readonly blockPath: readonly number[]
  readonly pmStart: number
  readonly pmEnd: number
  readonly withinTaskItem: boolean
  readonly resolution: PmBindingResolution
  readonly node: PMNode
}

export type PmBindingTable = {
  readonly rows: readonly PmBoundLeafRow[]
}

function isEmptyCanonicalParagraph(row: CanonicalLeafRow): boolean {
  return row.blockType === 'paragraph' && row.bodyFrom === row.bodyTo
}

function isSpuriousEmptyPmLeafRow(row: ModeSwitchPmLeafRow | undefined): boolean {
  if (!row) return false
  if (row.blockType === 'paragraph' && row.node.type.name === 'paragraph' && row.node.content.size === 0) {
    return true
  }
  if (row.blockType === 'heading' && row.node.type.name === 'heading' && row.node.content.size === 0) {
    return true
  }
  return false
}

function pmRowIsStandaloneTocParagraph(pmRow: ModeSwitchPmLeafRow): boolean {
  if (pmRow.blockType !== 'paragraph' || pmRow.node.type.name !== 'paragraph') return false
  const text = pmRow.node.textBetween(0, pmRow.node.content.size, '\n', '\n').trim()
  return /^\[toc\]$/iu.test(text)
}

function isCompatiblePmRow(pmRow: ModeSwitchPmLeafRow, row: CanonicalLeafRow): boolean {
  if (pmRow.blockType === row.blockType) return true
  if (pmRow.blockType === 'mermaidBlock' && row.blockType === 'codeBlock') return true
  if (pmRow.blockType === 'paragraph' && row.blockType === 'tocDirective') return pmRowIsStandaloneTocParagraph(pmRow)
  if (isSpuriousEmptyPmLeafRow(pmRow) && isEmptyCanonicalParagraph(row)) return true
  if (
    pmRow.blockType === 'heading' &&
    pmRow.node.type.name === 'heading' &&
    pmRow.node.content.size === 0 &&
    isEmptyCanonicalParagraph(row)
  ) {
    return true
  }
  return false
}

function materializeBoundRow(
  source: ModeSwitchPmLeafRow,
  row: CanonicalLeafRow,
  resolution: PmBindingResolution,
): PmBoundLeafRow {
  return Object.freeze({
    canonicalRowId: row.rowId,
    canonicalBlockType: row.blockType,
    rowKey: source.rowKey,
    blockPath: source.blockPath,
    pmStart: source.pmStart,
    pmEnd: source.pmEnd,
    withinTaskItem: source.withinTaskItem,
    resolution,
    node: source.node,
  })
}

export function bindPmToCanonicalRows(
  doc: PMNode,
  canonicalIR: CanonicalLeafIR,
): PmBindingTable {
  const pmRows = collectProjectablePmLeafRows(doc)
  const rows: PmBoundLeafRow[] = []
  let pmIndex = 0
  let lastBound = pmRows[0] ?? null

  for (const row of canonicalIR.rows) {
    let matched: PmBoundLeafRow | null = null
    let skippedSpurious = false

    for (let candidateIndex = pmIndex; candidateIndex < pmRows.length; candidateIndex += 1) {
      const candidate = pmRows[candidateIndex]!
      if (isCompatiblePmRow(candidate, row)) {
        matched = materializeBoundRow(candidate, row, skippedSpurious ? 'skip_spurious' : 'compatible')
        pmIndex = candidateIndex + 1
        lastBound = candidate
        break
      }
      if (isSpuriousEmptyPmLeafRow(candidate)) {
        skippedSpurious = true
        continue
      }
      break
    }

    if (matched == null) {
      const fallback = pmRows[Math.min(pmIndex, Math.max(0, pmRows.length - 1))] ?? lastBound
      if (fallback) {
        matched = materializeBoundRow(fallback, row, pmRows.length === 0 ? 'synthetic_last' : 'fallback_nearest')
        lastBound = fallback
        if (pmRows.length > 0 && pmIndex < pmRows.length) pmIndex += 1
      }
    }

    if (matched == null) {
      throw new Error('[mode-switch] PM binding failed: no PM leaf rows available')
    }
    rows.push(matched)
  }

  return Object.freeze({ rows: Object.freeze(rows) })
}

function canonicalSlicesToPmMdTokens(
  slices: readonly CanonicalSemanticSlice[],
): Array<{ text: string; kind: CanonicalSemanticSlice['kind']; markdownFrom: number; markdownTo: number }> {
  return slices.map((slice) => ({
    text: slice.text,
    kind: slice.kind,
    markdownFrom: slice.markdownFrom,
    markdownTo: slice.markdownTo,
  }))
}

function approximatePmSlices(
  row: CanonicalLeafRow,
  boundRow: PmBoundLeafRow,
): readonly SemanticSlice[] {
  if (row.semanticExtent === 0) {
    return Object.freeze([
      Object.freeze({
        semanticFrom: 0,
        semanticTo: 1,
        markdownFrom: row.bodyFrom,
        markdownTo: row.bodyFrom,
        kind: 'text' as const,
        pmFrom: boundRow.pmStart,
        pmToExclusive: Math.max(boundRow.pmStart + 1, boundRow.pmStart),
      }),
    ])
  }

  const width = Math.max(1, boundRow.pmEnd - boundRow.pmStart)
  let consumed = 0
  const slices: SemanticSlice[] = row.semanticSlices.map((slice, index) => {
    const textLen = slice.text.length
    const start =
      index === 0
        ? boundRow.pmStart
        : boundRow.pmStart + Math.round((consumed / row.semanticExtent) * width)
    consumed += textLen
    const end =
      index === row.semanticSlices.length - 1
        ? boundRow.pmEnd
        : boundRow.pmStart + Math.round((consumed / row.semanticExtent) * width)
    return Object.freeze({
      semanticFrom: slice.semanticFrom,
      semanticTo: slice.semanticTo,
      markdownFrom: slice.markdownFrom,
      markdownTo: slice.markdownTo,
      kind: slice.kind,
      pmFrom: start,
      pmToExclusive: Math.max(start, end),
    })
  })
  return Object.freeze(slices)
}

export function attachPmBindingToCanonicalRow(
  row: CanonicalLeafRow,
  boundRow: PmBoundLeafRow,
): readonly SemanticSlice[] {
  if (row.semanticExtent === 0) {
    return approximatePmSlices(row, boundRow)
  }

  const rawPm = collectPmSemanticTokens(boundRow.node, boundRow.pmStart)
  const pmTokens = rawPm ? mergeAdjacentPmTokens(rawPm) : []
  const mdTokens = canonicalSlicesToPmMdTokens(row.semanticSlices)
  if (pmTokens.length > 0) {
    const strict = zipPmMdSemanticTokens(pmTokens, mdTokens, row.semanticExtent)
    if (strict != null) return Object.freeze(strict.map((slice) => Object.freeze(slice)))
    const repartitioned = repartitionPmTokensToMatchMd(pmTokens, mdTokens)
    if (repartitioned != null) {
      const zipped = zipPmMdSemanticTokens(repartitioned, mdTokens, row.semanticExtent)
      if (zipped != null) return Object.freeze(zipped.map((slice) => Object.freeze(slice)))
    }
  }
  return approximatePmSlices(row, boundRow)
}

export function buildFrozenRowsFromCanonicalAndPmBinding(
  canonicalIR: CanonicalLeafIR,
  binding: PmBindingTable,
): readonly FrozenGeometryRow[] {
  const blocks: FrozenGeometryRow[] = canonicalIR.rows.map((row, index) => {
    const boundRow = binding.rows[index]!
    const semanticSlices = attachPmBindingToCanonicalRow(row, boundRow)
    const first = semanticSlices[0]!
    const last = semanticSlices[semanticSlices.length - 1]!
    return Object.freeze({
      blockIndex: index,
      rowId: row.rowId,
      rowKey: boundRow.rowKey,
      blockPath: Object.freeze([...boundRow.blockPath]),
      blockType: row.blockType,
      bindingResolution: boundRow.resolution,
      cmStart: first.markdownFrom,
      cmEnd: last.markdownTo,
      pmStart: boundRow.pmStart,
      pmEnd: boundRow.pmEnd,
      semanticExtent: row.semanticExtent,
      semanticSlices,
    })
  })
  return Object.freeze(blocks)
}
