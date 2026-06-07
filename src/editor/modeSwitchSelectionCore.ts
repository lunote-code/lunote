import type { ModeSwitchLeafPath } from './modeSwitchLeafRow'

/**
 * Mode switching frozen hierarchical selection core:
 * - `blockPath` / `rowKey` locate the projectable leaf row
 * - `blockIndex` is kept only as a legacy ordinal fallback/debug field
 */
export type HierarchicalSelectionCore = {
  readonly blockIndex: number
  readonly blockPath: ModeSwitchLeafPath
  readonly rowId?: string
  readonly rowKey: string
  readonly intraBlockOffset: number
}
