export type BuiltInThemeVariant =
  | 'github-light'
  | 'github-dark'
  | 'idea-light'
  | 'idea-dark'
  | 'dim-light'
  | 'dim-dark'

export type ThemeVariant = string

export type SystemTheme = 'light' | 'dark'

export const DEFAULT_THEME_VARIANT: BuiltInThemeVariant = 'github-dark'

const THEME_VARIANT_VALUES = new Set<string>([
  'github-light',
  'github-dark',
  'idea-light',
  'idea-dark',
  'dim-light',
  'dim-dark',
])

export function normalizeThemeVariant(value: unknown): ThemeVariant {
  if (typeof value !== 'string') return DEFAULT_THEME_VARIANT
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_THEME_VARIANT
  if (THEME_VARIANT_VALUES.has(trimmed)) return trimmed
  switch (trimmed) {
    case 'light':
      return 'github-light'
    case 'system':
    case 'dark':
    case 'github':
      return DEFAULT_THEME_VARIANT
    case 'idea':
      return 'idea-dark'
    case 'dim':
      return 'dim-dark'
    default:
      return trimmed
  }
}

export function isBuiltInThemeVariant(value: string): value is BuiltInThemeVariant {
  return THEME_VARIANT_VALUES.has(value)
}

export function resolveThemeVariant(activeTheme: ThemeVariant): ThemeVariant {
  return normalizeThemeVariant(activeTheme)
}

export function getThemeDisplayName(theme: ThemeVariant): string {
  return theme
}
