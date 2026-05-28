/** Break interactionModel ↔ knowledgeUIBridge circular dependency.*/
let invalidateOs: (() => void) | null = null

export function bindInteractionAxisOsInvalidation(fn: () => void): void {
  invalidateOs = fn
}

export function requestInteractionAxisOsInvalidation(): void {
  invalidateOs?.()
}
