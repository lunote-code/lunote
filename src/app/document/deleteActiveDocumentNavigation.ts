import { filterOutPath } from '../../lib/workspacePathUtils'
import { getTabBody } from './tabBodiesStore'

export function remainingTabsAfterDelete(openedTabs: readonly string[], deletedPath: string): string[] {
  return filterOutPath([...openedTabs], deletedPath)
}

export function pickTabFallbackAfterDelete(openedTabs: readonly string[], deletedPath: string): string {
  const remaining = remainingTabsAfterDelete(openedTabs, deletedPath)
  return remaining.length > 0 ? remaining[remaining.length - 1]! : ''
}

export function readFallbackTabBody(path: string): string {
  return getTabBody(path) ?? ''
}
