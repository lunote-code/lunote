import { projectAlongRow } from './modeSwitchProjection'
import { locateFrozenRow } from './modeSwitchFrozenLookup'
import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'
import type { FrozenGeometryRow, FrozenStructuralIR, SemanticSlice } from './modeSwitchStructuralIR'

/** Mode switch semantic anchor: block subscript + intra-block semantic offset (synonymous with PM hierarchical, naming aligned with FSM)*/
export type SemanticAnchor = {
  readonly blockIndex: number
  readonly blockPath: HierarchicalSelectionCore['blockPath']
  readonly rowKey: string
  readonly intraOffset: number
}

export type ModeSelectionSpan = {
  readonly from: number
  readonly to: number
}

export function pmHierarchicalCoreToSemanticAnchor(h: HierarchicalSelectionCore): SemanticAnchor {
  return Object.freeze({
    blockIndex: h.blockIndex,
    blockPath: h.blockPath,
    rowKey: h.rowKey,
    intraOffset: h.intraBlockOffset,
  })
}

export function semanticAnchorToHierarchicalCore(a: SemanticAnchor): HierarchicalSelectionCore {
  return Object.freeze({
    blockIndex: a.blockIndex,
    blockPath: a.blockPath,
    rowKey: a.rowKey,
    intraBlockOffset: a.intraOffset,
  })
}

function rowAt(ir: FrozenStructuralIR, anchor: {
  readonly blockIndex: number
  readonly rowKey?: string
  readonly blockPath?: readonly number[]
}): FrozenGeometryRow | null {
  return locateFrozenRow(ir, anchor).row
}

function findSliceForCmPos(slices: readonly SemanticSlice[], cmPos: number): SemanticSlice | null {
  for (const s of slices) {
    if (cmPos >= s.markdownFrom && cmPos <= s.markdownTo) return s
  }
  for (const s of slices) {
    if (cmPos < s.markdownFrom) return s
  }
  return slices[slices.length - 1] ?? null
}

/** CM canonical offset → semantic anchor (reverse semanticSlices along frozen IR)*/
export function cmPosToSemanticAnchor(cmPos: number, ir: FrozenStructuralIR): SemanticAnchor {
  const blocks = ir.blocks
  if (!blocks.length) {
    return Object.freeze({
      blockIndex: 0,
      blockPath: Object.freeze([]),
      rowKey: 'root',
      intraOffset: 0,
    })
  }

  let blockIndex = 0
  for (let i = 0; i < blocks.length; i++) {
    const row = blocks[i]!
    if (cmPos < row.cmStart && i > 0) break
    if (cmPos <= row.cmEnd) {
      blockIndex = i
      break
    }
    blockIndex = i
  }

  const row = blocks[blockIndex]!
  const clampedCm = Math.max(row.cmStart, Math.min(cmPos, row.cmEnd))
  const slice = findSliceForCmPos(row.semanticSlices, clampedCm)
  if (!slice) {
    return Object.freeze({
      blockIndex,
      blockPath: row.blockPath,
      rowKey: row.rowKey,
      intraOffset: row.semanticExtent,
    })
  }
  if (clampedCm <= slice.markdownFrom) {
    return Object.freeze({
      blockIndex,
      blockPath: row.blockPath,
      rowKey: row.rowKey,
      intraOffset: slice.semanticFrom,
    })
  }
  const lo = clampedCm - slice.markdownFrom
  const intra = slice.semanticFrom + lo
  return Object.freeze({
    blockIndex,
    blockPath: row.blockPath,
    rowKey: row.rowKey,
    intraOffset: Math.min(intra, row.semanticExtent),
  })
}

/** PM hierarchical core → CM canonical offset*/
export function semanticAnchorToCm(
  anchor: SemanticAnchor,
  ir: FrozenStructuralIR,
  canonicalLen: number,
): number {
  const row = rowAt(ir, anchor)
  if (!row) return 0
  return projectAlongRow(row, anchor.intraOffset, canonicalLen, 1).cm
}

/** PM hierarchical core → PM doc internal offset*/
export function semanticAnchorToPm(
  anchor: SemanticAnchor,
  ir: FrozenStructuralIR,
  canonicalLen: number,
  pmInnerMax: number,
): number {
  const row = rowAt(ir, anchor)
  if (!row) return Math.max(1, pmInnerMax)
  return projectAlongRow(row, anchor.intraOffset, canonicalLen, pmInnerMax).pm
}

export function deriveHierarchicalFromCmSelection(
  cmAnchor: number,
  cmHead: number,
  ir: FrozenStructuralIR,
): { anchor: HierarchicalSelectionCore; head: HierarchicalSelectionCore } {
  return Object.freeze({
    anchor: semanticAnchorToHierarchicalCore(cmPosToSemanticAnchor(cmAnchor, ir)),
    head: semanticAnchorToHierarchicalCore(cmPosToSemanticAnchor(cmHead, ir)),
  })
}

export function pmSelectionToSemanticAnchor(
  pmSelection: HierarchicalSelectionCore,
): SemanticAnchor {
  return pmHierarchicalCoreToSemanticAnchor(pmSelection)
}
