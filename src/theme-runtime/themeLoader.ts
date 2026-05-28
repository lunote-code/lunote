import type { RawThemeDefinition, ThemeColorTokens, ThemeRadiusTokens, ThemeSpacingTokens, UserTheme } from './themeTypes'
import { DEFAULT_THEME, mergeThemeDefinition } from './themeTokens'
import { normalizeThemeInput } from './themeCompatibilityLayer'

const COLOR_RE = /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgb\(|rgba\(|hsl\(|hsla\()/i
export const INVALID_CUSTOM_THEME_ID = 'invalid-custom'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && COLOR_RE.test(value.trim())
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function validateThemeSchema(input: unknown): input is RawThemeDefinition {
  if (!isObject(input)) return false
  if (input.id !== undefined && typeof input.id !== 'string') return false
  if (input.name !== undefined && typeof input.name !== 'string') return false

  if (input.colors !== undefined) {
    if (!isObject(input.colors)) return false
    for (const value of Object.values(input.colors)) {
      if (value !== undefined && !isColor(value)) return false
    }
  }

  if (input.radius !== undefined) {
    if (!isObject(input.radius)) return false
    for (const value of Object.values(input.radius)) {
      if (value !== undefined && optionalNumber(value) === undefined) return false
    }
  }

  if (input.spacing !== undefined) {
    if (!isObject(input.spacing)) return false
    for (const value of Object.values(input.spacing)) {
      if (value !== undefined && optionalNumber(value) === undefined) return false
    }
  }

  return true
}

function normalizeTheme(raw: RawThemeDefinition, sourceName?: string): UserTheme {
  const normalized = normalizeThemeInput(raw, DEFAULT_THEME)
  const partialColors: Partial<ThemeColorTokens> = normalized.colors
  const partialRadius: Partial<ThemeRadiusTokens> = {
    ...(optionalNumber(raw.radius?.card) !== undefined ? { card: optionalNumber(raw.radius?.card)! } : {}),
    ...(optionalNumber(raw.radius?.control) !== undefined ? { control: optionalNumber(raw.radius?.control)! } : {}),
  }
  const partialSpacing: Partial<ThemeSpacingTokens> = {
    ...(optionalNumber(raw.spacing?.row) !== undefined ? { row: optionalNumber(raw.spacing?.row)! } : {}),
    ...(optionalNumber(raw.spacing?.section) !== undefined ? { section: optionalNumber(raw.spacing?.section)! } : {}),
  }
  const partial = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : 'custom',
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Custom Theme',
    colors: partialColors,
    radius: partialRadius,
    spacing: partialSpacing,
  }

  return {
    ...mergeThemeDefinition(partial, normalized),
    builtIn: false,
    sourceName,
  }
}

export function loadThemeFromJSON(json: string, sourceName?: string): UserTheme {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!validateThemeSchema(parsed)) {
      return { ...DEFAULT_THEME, id: INVALID_CUSTOM_THEME_ID, name: 'Default Theme', builtIn: false, sourceName }
    }
    return normalizeTheme(parsed, sourceName)
  } catch {
    return { ...DEFAULT_THEME, id: INVALID_CUSTOM_THEME_ID, name: 'Default Theme', builtIn: false, sourceName }
  }
}

export async function loadUserThemeFromFile(file: File): Promise<UserTheme> {
  const json = await file.text()
  return loadThemeFromJSON(json, file.name)
}
