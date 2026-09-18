import { DEFAULT_NOTE_GRAPH_DEPTH } from './graphDepthPreference'
import type { GraphRecentActivityWindow } from './graphRecentActivityFilter'

export type NoteGraphFilterPreference = {
  showUnresolved: boolean
  showHeadingNodes: boolean
  /** Include notes with no wiki links (workspace graph only). */
  showOrphanNotes: boolean
  colorByFolder: boolean
  /** Color page nodes by their primary tag. */
  colorByTag: boolean
  /** When set, only show notes with this tag (plus route center in local mode). */
  filterTag: string | null
  /** Limit to notes with recent frontmatter dates when available. */
  recentActivity: GraphRecentActivityWindow
  edgeDirection: 'all' | 'incoming' | 'outgoing'
  /** Keep node labels visible when zoomed out (fit view). */
  alwaysShowLabels: boolean
}

export const DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE: NoteGraphFilterPreference = {
  showUnresolved: false,
  showHeadingNodes: false,
  showOrphanNotes: false,
  colorByFolder: true,
  colorByTag: false,
  filterTag: null,
  recentActivity: 'all',
  edgeDirection: 'all',
  alwaysShowLabels: false,
}

const STORAGE_KEY = 'luna:knowledge.graphFilters'

const filterListeners = new Set<() => void>()

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeDirection(
  value: unknown,
  fallback: NoteGraphFilterPreference['edgeDirection'],
): NoteGraphFilterPreference['edgeDirection'] {
  return value === 'incoming' || value === 'outgoing' || value === 'all' ? value : fallback
}

function normalizeRecentActivity(value: unknown): GraphRecentActivityWindow {
  return value === '7d' || value === '30d' || value === '90d' ? value : 'all'
}

function normalizeTag(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function normalizeNoteGraphFilterPreference(
  value: unknown,
): NoteGraphFilterPreference {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE }
  }
  const record = value as Partial<Record<keyof NoteGraphFilterPreference, unknown>>
  return {
    showUnresolved: normalizeBoolean(
      record.showUnresolved,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.showUnresolved,
    ),
    showHeadingNodes: normalizeBoolean(
      record.showHeadingNodes,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.showHeadingNodes,
    ),
    showOrphanNotes: normalizeBoolean(
      record.showOrphanNotes,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.showOrphanNotes,
    ),
    colorByFolder: normalizeBoolean(
      record.colorByFolder,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.colorByFolder,
    ),
    colorByTag: normalizeBoolean(record.colorByTag, DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.colorByTag),
    filterTag: normalizeTag(record.filterTag),
    recentActivity: normalizeRecentActivity(record.recentActivity),
    edgeDirection: normalizeDirection(
      record.edgeDirection,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.edgeDirection,
    ),
    alwaysShowLabels: normalizeBoolean(
      record.alwaysShowLabels,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.alwaysShowLabels,
    ),
  }
}

function readStoredPreference(): NoteGraphFilterPreference {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE }
    return normalizeNoteGraphFilterPreference(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE }
  }
}

let cachedPreference = readStoredPreference()

function notifyListeners(): void {
  for (const listener of filterListeners) listener()
}

function preferencesEqual(
  a: NoteGraphFilterPreference,
  b: NoteGraphFilterPreference,
): boolean {
  return (
    a.showUnresolved === b.showUnresolved &&
    a.showHeadingNodes === b.showHeadingNodes &&
    a.showOrphanNotes === b.showOrphanNotes &&
    a.colorByFolder === b.colorByFolder &&
    a.colorByTag === b.colorByTag &&
    a.filterTag === b.filterTag &&
    a.recentActivity === b.recentActivity &&
    a.edgeDirection === b.edgeDirection &&
    a.alwaysShowLabels === b.alwaysShowLabels
  )
}

export function getNoteGraphFilterPreference(): NoteGraphFilterPreference {
  return cachedPreference
}

export type GraphMoreMenuBadgeOptions = {
  /** When false, depth changes do not affect the badge (e.g. global topology). */
  includeDepth?: boolean
}

/** Count checked More-menu filter options (checkboxes + non-default depth). */
export function countActiveGraphMoreMenuOptions(
  filters: NoteGraphFilterPreference,
  depth: number,
  options: GraphMoreMenuBadgeOptions = {},
): number {
  const includeDepth = options.includeDepth !== false
  let count = 0
  if (filters.colorByFolder) count += 1
  if (filters.colorByTag) count += 1
  if (filters.filterTag) count += 1
  if (filters.recentActivity !== 'all') count += 1
  if (filters.showUnresolved) count += 1
  if (filters.showHeadingNodes) count += 1
  if (filters.showOrphanNotes) count += 1
  if (filters.alwaysShowLabels) count += 1
  if (includeDepth && depth !== DEFAULT_NOTE_GRAPH_DEPTH) count += 1
  return count
}

/** Badge count for the graph More menu trigger; hides the default-only color-by-folder state. */
export function getGraphMoreMenuBadgeCount(
  filters: NoteGraphFilterPreference,
  depth: number,
  options: GraphMoreMenuBadgeOptions = {},
): number {
  const count = countActiveGraphMoreMenuOptions(filters, depth, options)
  const onlyDefaultColorByFolder =
    count === 1 &&
    filters.colorByFolder &&
    !filters.colorByTag &&
    !filters.filterTag &&
    filters.recentActivity === 'all' &&
    !filters.showUnresolved &&
    !filters.showHeadingNodes &&
    !filters.showOrphanNotes &&
    !filters.alwaysShowLabels &&
    (options.includeDepth === false || depth === DEFAULT_NOTE_GRAPH_DEPTH)
  return onlyDefaultColorByFolder ? 0 : count
}

/** @deprecated Use getGraphMoreMenuBadgeCount — kept for callers that only tracked legacy toggles. */
export function countActiveGraphFilterOptions(
  filters: Pick<NoteGraphFilterPreference, 'showUnresolved' | 'showHeadingNodes'>,
): number {
  return Number(filters.showUnresolved) + Number(filters.showHeadingNodes)
}

export function setNoteGraphFilterPreference(
  next: Partial<NoteGraphFilterPreference>,
): NoteGraphFilterPreference {
  const normalized = normalizeNoteGraphFilterPreference({
    ...cachedPreference,
    ...next,
  })
  if (preferencesEqual(normalized, cachedPreference)) {
    return cachedPreference
  }
  cachedPreference = normalized
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // ignore quota / private mode
  }
  notifyListeners()
  return normalized
}

export function subscribeNoteGraphFilterPreference(listener: () => void): () => void {
  filterListeners.add(listener)
  return () => filterListeners.delete(listener)
}

export function resetNoteGraphFilterPreference(): void {
  cachedPreference = { ...DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  notifyListeners()
}
