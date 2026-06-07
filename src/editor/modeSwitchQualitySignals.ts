import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'
import { locateFrozenRow, type FrozenRowLookupResolutionKind } from './modeSwitchFrozenLookup'
import type { FrozenStructuralIR } from './modeSwitchStructuralIR'

export type ModeSwitchRestoreDistanceKind =
  | 'same_leaf_row'
  | 'same_block_path'
  | 'nearby_block'
  | 'unrelated'
  | 'unknown'

type ModeSwitchHierarchicalLike = Pick<
  HierarchicalSelectionCore,
  'blockIndex' | 'rowId' | 'rowKey' | 'blockPath'
>

export type ModeSwitchAnchorQualitySummary = {
  readonly blockIndex: number
  readonly rowId: string | null
  readonly rowKey: string
  readonly blockPath: readonly number[]
  readonly blockPathLabel: string
  readonly lookupResolution: FrozenRowLookupResolutionKind | null
}

export type ModeSwitchRestoreQualitySummary = {
  readonly distance: ModeSwitchRestoreDistanceKind
  readonly expected: ModeSwitchAnchorQualitySummary | null
  readonly actual: ModeSwitchAnchorQualitySummary | null
}

export function compareModeSwitchRestoreDistance(
  expected: ModeSwitchHierarchicalLike | null | undefined,
  actual: ModeSwitchHierarchicalLike | null | undefined,
): ModeSwitchRestoreDistanceKind {
  if (!expected || !actual) return 'unknown'
  if (expected.rowId && actual.rowId && expected.rowId === actual.rowId) return 'same_leaf_row'
  if (expected.rowKey === actual.rowKey) return 'same_leaf_row'
  if (expected.blockPath.length === actual.blockPath.length) {
    let samePath = true
    for (let i = 0; i < expected.blockPath.length; i += 1) {
      if (expected.blockPath[i] !== actual.blockPath[i]) {
        samePath = false
        break
      }
    }
    if (samePath) return 'same_block_path'
  }
  if (Math.abs(expected.blockIndex - actual.blockIndex) <= 1) return 'nearby_block'
  return 'unrelated'
}

export function summarizeModeSwitchAnchorQuality(
  ir: FrozenStructuralIR | null | undefined,
  anchor: ModeSwitchHierarchicalLike | null | undefined,
): ModeSwitchAnchorQualitySummary | null {
  if (!anchor) return null
  return Object.freeze({
    blockIndex: anchor.blockIndex,
    rowId: anchor.rowId ?? null,
    rowKey: anchor.rowKey,
    blockPath: Object.freeze([...anchor.blockPath]),
    blockPathLabel: anchor.blockPath.join('.'),
    lookupResolution: ir ? locateFrozenRow(ir, anchor).resolution : null,
  })
}

export function summarizeModeSwitchRestoreQuality(args: {
  expected: ModeSwitchHierarchicalLike | null | undefined
  actual: ModeSwitchHierarchicalLike | null | undefined
  ir: FrozenStructuralIR | null | undefined
}): ModeSwitchRestoreQualitySummary {
  return Object.freeze({
    distance: compareModeSwitchRestoreDistance(args.expected, args.actual),
    expected: summarizeModeSwitchAnchorQuality(args.ir, args.expected),
    actual: summarizeModeSwitchAnchorQuality(args.ir, args.actual),
  })
}
