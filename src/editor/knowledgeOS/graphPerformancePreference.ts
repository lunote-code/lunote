export type NoteGraphPerformanceTier = 'compact' | 'standard' | 'extended'

export type NoteGraphPerformanceLimits = {
  maxNodes: number
  maxEdges: number
}

export const DEFAULT_NOTE_GRAPH_PERFORMANCE_TIER: NoteGraphPerformanceTier = 'extended'

const PERFORMANCE_LIMITS: Record<NoteGraphPerformanceTier, NoteGraphPerformanceLimits> = {
  compact: { maxNodes: 120, maxEdges: 200 },
  standard: { maxNodes: 250, maxEdges: 400 },
  extended: { maxNodes: 400, maxEdges: 700 },
}

const STORAGE_KEY = 'luna:knowledge.graphPerformanceTier'

const listeners = new Set<() => void>()

function normalizeTier(value: unknown): NoteGraphPerformanceTier {
  if (value === 'compact' || value === 'standard' || value === 'extended') return value
  return DEFAULT_NOTE_GRAPH_PERFORMANCE_TIER
}

function readStoredTier(): NoteGraphPerformanceTier {
  if (typeof localStorage === 'undefined') return DEFAULT_NOTE_GRAPH_PERFORMANCE_TIER
  try {
    return normalizeTier(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_NOTE_GRAPH_PERFORMANCE_TIER
  }
}

let cachedTier = readStoredTier()

export function getNoteGraphPerformanceTier(): NoteGraphPerformanceTier {
  return cachedTier
}

export function getNoteGraphPerformanceLimits(): NoteGraphPerformanceLimits {
  return PERFORMANCE_LIMITS[cachedTier]
}

export function setNoteGraphPerformanceTier(next: NoteGraphPerformanceTier): NoteGraphPerformanceTier {
  const normalized = normalizeTier(next)
  if (normalized === cachedTier) return normalized
  cachedTier = normalized
  try {
    localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    // ignore quota / private mode
  }
  for (const listener of listeners) listener()
  return normalized
}

export function subscribeNoteGraphPerformanceTier(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetNoteGraphPerformanceTier(): void {
  cachedTier = DEFAULT_NOTE_GRAPH_PERFORMANCE_TIER
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  for (const listener of listeners) listener()
}

export function listNoteGraphPerformanceTiers(): readonly NoteGraphPerformanceTier[] {
  return ['compact', 'standard', 'extended']
}
