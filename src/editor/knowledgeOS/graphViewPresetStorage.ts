import type { NoteGraphFilterPreference } from './graphFilterPreference'
import { normalizeNoteGraphFilterPreference } from './graphFilterPreference'
import type { NoteGraphPerformanceTier } from './graphPerformancePreference'
import type { NoteGraphTopologyMode } from './graphTopologyModePreference'

/** English fallback when callers omit a name; UI should pass a localized label before save. */
const PRESET_NAME_FALLBACK = 'Graph view'

export type GraphViewPreset = {
  id: string
  name: string
  topologyMode: NoteGraphTopologyMode
  performanceTier: NoteGraphPerformanceTier
  depth: number
  filters: NoteGraphFilterPreference
}

export type GraphViewPresetSaveResult =
  | { ok: true; preset: GraphViewPreset }
  | { ok: false; error: 'storage' }

const STORAGE_KEY = 'luna:knowledge.graphViewPresets'
const MAX_PRESETS = 8

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function parsePresets(raw: string | null): GraphViewPreset[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is GraphViewPreset => Boolean(entry && typeof entry === 'object'))
      .slice(0, MAX_PRESETS)
  } catch {
    return []
  }
}

function readPresetsFromStorage(): GraphViewPreset[] {
  if (typeof localStorage === 'undefined') return []
  return parsePresets(localStorage.getItem(STORAGE_KEY))
}

let cachedPresets: GraphViewPreset[] = readPresetsFromStorage()

function writePresets(presets: GraphViewPreset[]): boolean {
  if (typeof localStorage === 'undefined') return false
  const next = presets.slice(0, MAX_PRESETS)
  try {
    const serialized = JSON.stringify(next)
    localStorage.setItem(STORAGE_KEY, serialized)
    if (localStorage.getItem(STORAGE_KEY) !== serialized) return false
    cachedPresets = next
    notify()
    return true
  } catch {
    return false
  }
}

export function listGraphViewPresets(): GraphViewPreset[] {
  return cachedPresets
}

export function subscribeGraphViewPresets(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function saveGraphViewPreset(input: {
  name: string
  topologyMode: NoteGraphTopologyMode
  performanceTier: NoteGraphPerformanceTier
  depth: number
  filters: NoteGraphFilterPreference
}): GraphViewPresetSaveResult {
  const preset: GraphViewPreset = {
    id: `preset-${Date.now().toString(36)}`,
    name: input.name.trim() || PRESET_NAME_FALLBACK,
    topologyMode: input.topologyMode,
    performanceTier: input.performanceTier,
    depth: input.depth,
    filters: normalizeNoteGraphFilterPreference(input.filters),
  }
  const next = [preset, ...cachedPresets.filter((entry) => entry.name !== preset.name)].slice(
    0,
    MAX_PRESETS,
  )
  if (!writePresets(next)) return { ok: false, error: 'storage' }
  return { ok: true, preset }
}

export function deleteGraphViewPreset(id: string): boolean {
  const next = cachedPresets.filter((entry) => entry.id !== id)
  if (next.length === cachedPresets.length) return true
  return writePresets(next)
}

/** Test-only reset — clears listeners and reloads presets from storage (optional wipe). */
export function __resetGraphViewPresetStorageForTests(clearStorage = true): void {
  listeners.clear()
  if (clearStorage && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  cachedPresets = readPresetsFromStorage()
}
