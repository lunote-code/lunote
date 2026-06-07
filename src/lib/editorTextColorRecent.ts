import { LUNA_TEXT_COLOR_PRESETS, normalizeTextColor } from '../editor/lunaTextColor'

const STORAGE_KEY = 'lunote.editor.textColor.recent'
const MAX_RECENT = 8

const PRESET_VALUES = new Set<string>(LUNA_TEXT_COLOR_PRESETS.map((p) => p.value))

function sanitizeRecentList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const color = normalizeTextColor(item)
    if (!color || out.includes(color)) continue
    out.push(color)
    if (out.length >= MAX_RECENT) break
  }
  return out
}

export function readRecentTextColors(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return sanitizeRecentList(raw)
  } catch {
    return []
  }
}

/** Persist a successfully applied text color (skips presets to keep the recent row useful). */
export function rememberTextColor(color: string | null): void {
  const normalized = normalizeTextColor(color)
  if (!normalized || PRESET_VALUES.has(normalized)) return
  const next = [normalized, ...readRecentTextColors().filter((c) => c !== normalized)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}
