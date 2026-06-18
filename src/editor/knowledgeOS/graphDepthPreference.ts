export const DEFAULT_NOTE_GRAPH_DEPTH = 2
export const MIN_NOTE_GRAPH_DEPTH = 1
export const MAX_NOTE_GRAPH_DEPTH = 4

const STORAGE_KEY = 'luna:knowledge.graphDepth'

const depthListeners = new Set<() => void>()

export function normalizeNoteGraphDepth(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN
  if (!Number.isFinite(parsed)) return DEFAULT_NOTE_GRAPH_DEPTH
  return Math.min(MAX_NOTE_GRAPH_DEPTH, Math.max(MIN_NOTE_GRAPH_DEPTH, Math.trunc(parsed)))
}

function readStoredDepth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_NOTE_GRAPH_DEPTH
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return DEFAULT_NOTE_GRAPH_DEPTH
    return normalizeNoteGraphDepth(raw)
  } catch {
    return DEFAULT_NOTE_GRAPH_DEPTH
  }
}

let cachedDepth = readStoredDepth()

export function getNoteGraphDepthPreference(): number {
  return cachedDepth
}

export function setNoteGraphDepthPreference(next: number): number {
  const normalized = normalizeNoteGraphDepth(next)
  if (normalized === cachedDepth) return normalized
  cachedDepth = normalized
  try {
    localStorage.setItem(STORAGE_KEY, String(normalized))
  } catch {
    // ignore quota / private mode
  }
  for (const listener of depthListeners) listener()
  return normalized
}

export function subscribeNoteGraphDepthPreference(listener: () => void): () => void {
  depthListeners.add(listener)
  return () => depthListeners.delete(listener)
}

export function resetNoteGraphDepthPreference(): void {
  cachedDepth = DEFAULT_NOTE_GRAPH_DEPTH
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  for (const listener of depthListeners) listener()
}
