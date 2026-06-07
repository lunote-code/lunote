import type { FrozenGeometryRow, FrozenStructuralIR } from './modeSwitchStructuralIR'

export type FrozenRowLocator = {
  readonly blockIndex?: number
  readonly rowId?: string
  readonly rowKey?: string
  readonly blockPath?: readonly number[]
}

export type FrozenRowLookupResolutionKind = 'row_id' | 'row_key' | 'block_path' | 'block_index' | 'missing'

export type FrozenRowLookupResult = {
  readonly row: FrozenGeometryRow | null
  readonly resolution: FrozenRowLookupResolutionKind
}

export function isSameFrozenBlockPath(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Projection/runtime consumers must resolve rows through stable structure data
 * (`rowKey`, `blockPath`, `blockIndex`) instead of relying on row-key encoding
 * details like `blockPath.join('.')`.
 */
export function locateFrozenRow(
  ir: FrozenStructuralIR,
  locator: FrozenRowLocator,
): FrozenRowLookupResult {
  const blocks = ir.blocks
  if (!blocks.length) {
    return Object.freeze({ row: null, resolution: 'missing' })
  }
  if (locator.rowId) {
    const hit = blocks.find((row) => row.rowId === locator.rowId) ?? null
    if (hit) return Object.freeze({ row: hit, resolution: 'row_id' })
  }
  if (locator.rowKey) {
    const hit = blocks.find((row) => row.rowKey === locator.rowKey) ?? null
    if (hit) return Object.freeze({ row: hit, resolution: 'row_key' })
  }
  if (locator.blockPath) {
    const hit = blocks.find((row) => isSameFrozenBlockPath(row.blockPath, locator.blockPath)) ?? null
    if (hit) return Object.freeze({ row: hit, resolution: 'block_path' })
  }
  if (
    typeof locator.blockIndex === 'number' &&
    Number.isInteger(locator.blockIndex) &&
    locator.blockIndex >= 0 &&
    locator.blockIndex < blocks.length
  ) {
    return Object.freeze({
      row: blocks[locator.blockIndex] ?? null,
      resolution: 'block_index',
    })
  }
  return Object.freeze({ row: null, resolution: 'missing' })
}
