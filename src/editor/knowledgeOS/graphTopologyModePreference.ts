export type NoteGraphTopologyMode = 'local' | 'global'

export const DEFAULT_NOTE_GRAPH_TOPOLOGY_MODE: NoteGraphTopologyMode = 'local'

const STORAGE_KEY = 'luna:knowledge.graphTopologyMode'

const listeners = new Set<() => void>()

function normalizeMode(value: unknown): NoteGraphTopologyMode {
  return value === 'global' ? 'global' : DEFAULT_NOTE_GRAPH_TOPOLOGY_MODE
}

function readStoredMode(): NoteGraphTopologyMode {
  if (typeof localStorage === 'undefined') return DEFAULT_NOTE_GRAPH_TOPOLOGY_MODE
  try {
    return normalizeMode(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_NOTE_GRAPH_TOPOLOGY_MODE
  }
}

let cachedMode = readStoredMode()

export function getNoteGraphTopologyModePreference(): NoteGraphTopologyMode {
  return cachedMode
}

export function setNoteGraphTopologyModePreference(next: NoteGraphTopologyMode): NoteGraphTopologyMode {
  const normalized = normalizeMode(next)
  if (normalized === cachedMode) return normalized
  cachedMode = normalized
  try {
    localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    // ignore quota / private mode
  }
  for (const listener of listeners) listener()
  return normalized
}

export function subscribeNoteGraphTopologyModePreference(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetNoteGraphTopologyModePreference(): void {
  cachedMode = DEFAULT_NOTE_GRAPH_TOPOLOGY_MODE
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  for (const listener of listeners) listener()
}
