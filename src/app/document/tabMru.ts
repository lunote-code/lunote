import { normPath, pathsEqual } from '../../lib/workspacePathUtils'

export type TabSwitcherCandidate = {
  path: string
  label: string
}

/** Move `path` to the front of the MRU list (most recently used first). */
export function touchTabMru(mruPaths: readonly string[], path: string): string[] {
  if (!path.trim()) return [...mruPaths]
  const rest = mruPaths.filter((candidate) => !pathsEqual(candidate, path))
  return [path, ...rest]
}

export function buildTabSwitcherCandidates(
  query: string,
  openedTabs: readonly string[],
  mruPaths: readonly string[],
  tabLabel: (path: string) => string,
): readonly TabSwitcherCandidate[] {
  const needle = query.trim().toLowerCase()
  const ordered: string[] = []
  const seen = new Set<string>()

  const addPath = (path: string) => {
    if (!openedTabs.some((tab) => pathsEqual(tab, path))) return
    const key = normPath(path).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    ordered.push(path)
  }

  for (const path of mruPaths) addPath(path)
  for (const path of openedTabs) addPath(path)

  const filtered = needle
    ? ordered.filter((path) => {
        const label = tabLabel(path).toLowerCase()
        return label.includes(needle) || normPath(path).toLowerCase().includes(needle)
      })
    : ordered

  return filtered.map((path) => ({ path, label: tabLabel(path) }))
}
