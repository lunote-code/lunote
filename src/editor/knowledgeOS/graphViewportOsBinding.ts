/** Break graphViewportRuntime ↔ knowledgeUIBridge circular dependency.*/
let invalidateOs: (() => void) | null = null

export function bindGraphViewportOsInvalidation(fn: () => void): void {
  invalidateOs = fn
}

export function requestGraphViewportOsInvalidation(): void {
  invalidateOs?.()
}
