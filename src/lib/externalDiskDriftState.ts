import { pathsEqual } from './workspacePathUtils'

export function clearExternalDiskDriftInState(prev: ReadonlySet<string>, path: string): Set<string> {
  if (!path) return new Set(prev)
  const next = new Set(prev)
  for (const current of [...next]) {
    if (pathsEqual(current, path)) next.delete(current)
  }
  return next
}

export function hasExternalDiskDriftInState(path: string, externalDiskChangedPaths: ReadonlySet<string>): boolean {
  if (!path) return false
  return [...externalDiskChangedPaths].some((candidate) => pathsEqual(candidate, path))
}
