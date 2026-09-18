const activeLocks = new Map<string, string>()

function normalizeDocKey(docKey: string | null | undefined): string | null {
  const trimmed = docKey?.trim()
  return trimmed ? trimmed : null
}

export function acquireEditorAiWriteLock(docKey: string | null | undefined, owner: string): boolean {
  const key = normalizeDocKey(docKey)
  if (!key) return true
  const current = activeLocks.get(key)
  if (current && current !== owner) return false
  activeLocks.set(key, owner)
  return true
}

export function releaseEditorAiWriteLock(docKey: string | null | undefined, owner: string): void {
  const key = normalizeDocKey(docKey)
  if (!key) return
  if (activeLocks.get(key) === owner) {
    activeLocks.delete(key)
  }
}

export function resetEditorAiWriteLocksForTests(): void {
  activeLocks.clear()
}
