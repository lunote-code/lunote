import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'
import { locateFrozenRow } from './modeSwitchFrozenLookup'
import {
  assertNoSemanticFallback,
  assertSemanticSlicesCoverSemanticSpace,
  type FrozenGeometryRow,
  type FrozenStructuralIR,
  type SemanticSlice,
} from './modeSwitchStructuralIR'

export type FrozenModeSwitchHierarchicalInput = {
  readonly bufferHash: string
  readonly anchor: HierarchicalSelectionCore
  readonly head: HierarchicalSelectionCore
}

function clampPmDocPos(innerMax: number, pos: number): number {
  if (!Number.isFinite(pos)) return 1
  return Math.max(1, Math.min(innerMax, Math.round(pos)))
}

function findSliceForIntra(
  slices: readonly SemanticSlice[],
  intra: number,
  semanticExtent: number,
): SemanticSlice {
  const t = Math.min(Math.max(0, intra), semanticExtent)
  for (const s of slices) {
    if (t >= s.semanticFrom && t < s.semanticTo) return s
  }
  return slices[slices.length - 1]!
}

/**
 * Intra-slice semantics → canonical / PM: Use constant offset (no ratio) within hit token; CM / PM are all from frozen token geometry.
 */
export function projectAlongRow(
  row: FrozenGeometryRow,
  intraBlockOffset: number,
  fullMdLen: number,
  innerMax: number,
): { cm: number; pm: number } {
  const slice = findSliceForIntra(row.semanticSlices, intraBlockOffset, row.semanticExtent)
  const t = Math.min(Math.max(0, intraBlockOffset), row.semanticExtent)
  const lo = t - slice.semanticFrom
  const mdLen = Math.max(0, slice.markdownTo - slice.markdownFrom)
  const cm = slice.markdownFrom + Math.min(lo, mdLen)
  const pmSpan = Math.max(0, slice.pmToExclusive - slice.pmFrom)
  const pm = slice.pmFrom + Math.min(lo, pmSpan)
  const boundedPm =
    row.pmEnd < row.pmStart
      ? row.pmStart
      : Math.max(row.pmStart, Math.min(pm, row.pmEnd))
  return {
    cm: Math.max(0, Math.min(fullMdLen, cm)),
    pm: clampPmDocPos(innerMax, boundedPm),
  }
}

function assertIrGeometryDev(ir: FrozenStructuralIR, canonicalBuffer: string): void {
  if (!import.meta.env.DEV) return
  const canonicalLen = canonicalBuffer.length
  for (let i = 0; i < ir.blocks.length; i += 1) {
    const row = ir.blocks[i]!
    if (row.semanticExtent < 0 || row.pmStart > row.pmEnd) {
       
      console.error('[projection-purity] invalid IR row', { index: i, row })
      return
    }
    if (!row.semanticSlices.length) {
       
      console.error('[projection-purity] row missing semanticSlices', { index: i })
      return
    }
    const s0 = row.semanticSlices[0]!
    const sL = row.semanticSlices[row.semanticSlices.length - 1]!
    if (s0.semanticFrom !== 0 || sL.semanticTo !== row.semanticExtent + 1) {
       
      console.error('[projection-purity] semanticSlices do not cover [0, semanticExtent]', {
        index: i,
        s0,
        sL,
        semanticExtent: row.semanticExtent,
      })
      return
    }
    for (const sl of row.semanticSlices) {
      if (sl.semanticFrom >= sl.semanticTo || sl.markdownFrom > sl.markdownTo) {
         
        console.error('[projection-purity] invalid semanticSlice', { index: i, sl })
        return
      }
      if (!sl.kind) {
         
        console.error('[projection-purity] semanticSlice missing kind', { index: i, sl })
        return
      }
      if (typeof sl.pmFrom !== 'number' || typeof sl.pmToExclusive !== 'number') {
         
        console.error('[projection-purity] semanticSlice missing pm span', { index: i, sl })
        return
      }
      if (canonicalLen > 0 && sl.markdownTo > canonicalLen) {
         
        console.error('[projection-purity] slice markdown past canonical', { index: i, sl, canonicalLen })
        return
      }
    }
    if (row.cmStart > row.cmEnd) {
       
      console.error('[projection-purity] invalid IR row cm span', { index: i, row })
      return
    }
    if (canonicalLen > 0 && row.cmEnd > canonicalLen) {
       
      console.error('[projection-purity] cmEnd past canonical length', { index: i, cmEnd: row.cmEnd, canonicalLen })
      return
    }
    assertSemanticSlicesCoverSemanticSpace(row.semanticSlices, row.semanticExtent, canonicalBuffer)
    assertNoSemanticFallback(row)
  }
}

/**
 * DEV: Projection purity — IR numerical invariant (no runtime parse/serialize).
 */
export function assertProjectionPurity(ir: FrozenStructuralIR, canonicalBuffer: string): void {
  if (!import.meta.env.DEV) return
  assertIrGeometryDev(ir, canonicalBuffer)
}

/**
 * Only `frozenStructuralIR.blocks` + `hierarchical`’s leaf identity / `intraBlockOffset`
 * (pure lookup + constant offset within token).
 */
export function computeSelection(
  hierarchical: FrozenModeSwitchHierarchicalInput | null,
  frozenStructuralIR: FrozenStructuralIR,
  canonicalBuffer: string,
  pmDocInnerMaxPos: number,
): { pmAnchor: number; pmHead: number; cmAnchor: number; cmHead: number } {
  const len = canonicalBuffer.length
  const innerMax = pmDocInnerMaxPos
  const blocks = frozenStructuralIR.blocks

  assertIrGeometryDev(frozenStructuralIR, canonicalBuffer)

  if (!hierarchical) {
    const pm = clampPmDocPos(innerMax, 1)
    return { pmAnchor: pm, pmHead: pm, cmAnchor: 0, cmHead: 0 }
  }

  if (!blocks.length) {
    const pm = clampPmDocPos(innerMax, 1)
    return { pmAnchor: pm, pmHead: pm, cmAnchor: 0, cmHead: 0 }
  }

  const rowAt = (h: HierarchicalSelectionCore): FrozenGeometryRow => {
    const resolved = locateFrozenRow(frozenStructuralIR, h)
    if (resolved.row) return resolved.row
    throw new Error('[mode-switch] missing frozen leaf row for hierarchical anchor')
  }

  const ra = rowAt(hierarchical.anchor)
  const rb = rowAt(hierarchical.head)
  const a = projectAlongRow(ra, hierarchical.anchor.intraBlockOffset, len, innerMax)
  const b = projectAlongRow(rb, hierarchical.head.intraBlockOffset, len, innerMax)
  return { pmAnchor: a.pm, pmHead: b.pm, cmAnchor: a.cm, cmHead: b.cm }
}
