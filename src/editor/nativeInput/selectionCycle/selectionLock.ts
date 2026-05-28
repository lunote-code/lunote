const lockDepth = new WeakMap<HTMLTextAreaElement, number>()
let globalLockDepth = 0

export function lockSelection(el: HTMLTextAreaElement): void {
  lockDepth.set(el, (lockDepth.get(el) ?? 0) + 1)
  globalLockDepth += 1
  el.dataset.selectionCycleLock = '1'
}

export function unlockSelection(el: HTMLTextAreaElement): void {
  const next = (lockDepth.get(el) ?? 1) - 1
  if (next <= 0) {
    lockDepth.delete(el)
    delete el.dataset.selectionCycleLock
  } else {
    lockDepth.set(el, next)
  }
  globalLockDepth = Math.max(0, globalLockDepth - 1)
}

export function isSelectionLocked(el: HTMLTextAreaElement): boolean {
  return (lockDepth.get(el) ?? 0) > 0
}

/** runtime/scheduler must not mutate DOM selection during selection lock*/
export function isAnySelectionLocked(): boolean {
  return globalLockDepth > 0
}
