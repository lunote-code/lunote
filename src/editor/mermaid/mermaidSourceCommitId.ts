/** Globally unique commit token; flush must carry matching id, expired requests will be discarded*/
export function newMermaidCommitId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}
