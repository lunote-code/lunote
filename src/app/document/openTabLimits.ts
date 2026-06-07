import { pathsEqual } from '../../lib/workspacePathUtils'

/** Maximum workspace document tabs; also bounds in-memory tab body LRU cache. */
export const MAX_OPEN_DOCUMENT_TABS = 12

/** Show a non-blocking near-limit hint in the tab bar from this count upward. */
export const OPEN_TAB_LIMIT_WARN_AT = 10

export function isNearOpenTabLimit(openCount: number): boolean {
  return openCount >= OPEN_TAB_LIMIT_WARN_AT && openCount < MAX_OPEN_DOCUMENT_TABS
}

export function isAtOpenTabLimit(openCount: number): boolean {
  return openCount >= MAX_OPEN_DOCUMENT_TABS
}

export function isPathInOpenTabs(openedTabs: readonly string[], path: string): boolean {
  if (!path) return false
  return openedTabs.some((tab) => pathsEqual(tab, path))
}

/** Distinct tab count after adding `path` (no-op when the path is already open). */
export function countOpenTabsAfterAdding(openedTabs: readonly string[], path: string): number {
  if (!path || isPathInOpenTabs(openedTabs, path)) return openedTabs.length
  return openedTabs.length + 1
}

export function wouldExceedOpenTabLimit(openedTabs: readonly string[], path: string): boolean {
  return countOpenTabsAfterAdding(openedTabs, path) > MAX_OPEN_DOCUMENT_TABS
}

export function mergeOpenTabs(openedTabs: readonly string[], pathsToAdd: readonly string[]): string[] {
  const next = [...openedTabs]
  for (const path of pathsToAdd) {
    if (!path || isPathInOpenTabs(next, path)) continue
    next.push(path)
  }
  return next
}

export function wouldExceedOpenTabLimitForPaths(
  openedTabs: readonly string[],
  pathsToAdd: readonly string[],
): boolean {
  return mergeOpenTabs(openedTabs, pathsToAdd).length > MAX_OPEN_DOCUMENT_TABS
}

/** Keep the most recently listed tabs when restoring or setting tabs in bulk. */
export function clampOpenTabList(tabs: readonly string[]): string[] {
  if (tabs.length <= MAX_OPEN_DOCUMENT_TABS) return [...tabs]
  return tabs.slice(0, MAX_OPEN_DOCUMENT_TABS)
}
