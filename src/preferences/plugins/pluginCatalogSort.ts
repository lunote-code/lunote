import type { PluginCatalogIndexEntry } from '../../plugins/pluginTypes'

export type PluginSortMode = 'featured' | 'name' | 'updated'

export const PLUGIN_SORT_STORAGE_KEY = 'luna.prefs.pluginsSortMode'

const VALID_SORT_MODES: readonly PluginSortMode[] = ['featured', 'name', 'updated']

export function readStoredPluginSortMode(): PluginSortMode {
  try {
    const raw = localStorage.getItem(PLUGIN_SORT_STORAGE_KEY)
    if (raw && VALID_SORT_MODES.includes(raw as PluginSortMode)) {
      return raw as PluginSortMode
    }
  } catch {
    /* ignore */
  }
  return 'featured'
}

export function writeStoredPluginSortMode(mode: PluginSortMode): void {
  try {
    localStorage.setItem(PLUGIN_SORT_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

function updatedAtValue(row: PluginCatalogIndexEntry): number {
  if (!row.updatedAt) return 0
  const parsed = Date.parse(row.updatedAt)
  return Number.isFinite(parsed) ? parsed : 0
}

export function sortPluginCatalogRows<T extends PluginCatalogIndexEntry>(
  rows: readonly T[],
  mode: PluginSortMode,
): T[] {
  const copy = [...rows]
  copy.sort((left, right) => {
    if (mode === 'featured') {
      const leftFeatured = left.featured ? 1 : 0
      const rightFeatured = right.featured ? 1 : 0
      if (leftFeatured !== rightFeatured) return rightFeatured - leftFeatured
      const updatedDiff = updatedAtValue(right) - updatedAtValue(left)
      if (updatedDiff !== 0) return updatedDiff
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }
    if (mode === 'updated') {
      const updatedDiff = updatedAtValue(right) - updatedAtValue(left)
      if (updatedDiff !== 0) return updatedDiff
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
  return copy
}
