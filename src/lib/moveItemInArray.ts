/** Move one item; `toIndex` is the index in the array after the move completes. */
export function moveItemInArray<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...items]
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return [...items]
  }
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item!)
  return next
}

/** Map a drop position (0..length insert-before) to `moveItemInArray` target index. */
export function insertBeforeIndexToMoveTarget(fromIndex: number, insertBefore: number): number {
  let to = insertBefore
  if (insertBefore > fromIndex) to -= 1
  return to
}

export function isNoOpTabReorder(fromIndex: number, insertBefore: number): boolean {
  return insertBefore === fromIndex || insertBefore === fromIndex + 1
}
