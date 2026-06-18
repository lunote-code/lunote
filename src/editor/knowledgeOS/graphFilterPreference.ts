export type NoteGraphFilterPreference = {
  showUnresolved: boolean
  showHeadingNodes: boolean
  edgeDirection: 'all' | 'incoming' | 'outgoing'
}

export const DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE: NoteGraphFilterPreference = {
  showUnresolved: false,
  showHeadingNodes: false,
  edgeDirection: 'all',
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
    edgeDirection: normalizeDirection(
      record.edgeDirection,
      DEFAULT_NOTE_GRAPH_FILTER_PREFERENCE.edgeDirection,
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
    a.edgeDirection === b.edgeDirection
  )
}

export function getNoteGraphFilterPreference(): NoteGraphFilterPreference {
  return cachedPreference
}

/** Number of enabled optional graph filter toggles (0–2). Drives the Filters menu badge. */
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
