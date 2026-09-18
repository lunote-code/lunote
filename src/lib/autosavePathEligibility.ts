export function isAutosaveEligiblePath(
  path: string,
  isBufferTabId: (candidate: string) => boolean,
  isAutosaveSuspended: (candidate: string) => boolean,
): boolean {
  if (!path) return false
  if (isBufferTabId(path)) return false
  if (isAutosaveSuspended(path)) return false
  return true
}

export function filterAutosaveEligibleDirtyPaths(
  dirtyPaths: readonly string[],
  isBufferTabId: (candidate: string) => boolean,
  isAutosaveSuspended: (candidate: string) => boolean,
): string[] {
  return dirtyPaths.filter((path) => isAutosaveEligiblePath(path, isBufferTabId, isAutosaveSuspended))
}
