import type { RawThemeDefinition, ThemeDefinition } from './themeTypes'
import { DEFAULT_THEME, mergeThemeDefinition } from './themeTokens'

type LegacyPrimitiveTokens = {
  bg?: string
  fg?: string
  primary?: string
  border?: string
  muted?: string
}

type CompatibleThemeInput = RawThemeDefinition | ThemeDefinition | unknown

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readColor(colors: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!colors) return undefined
  for (const key of keys) {
    const value = colors[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function hasSemanticTokens(input: CompatibleThemeInput): boolean {
  if (!isRecord(input) || !isRecord(input.colors)) return false
  return (
    typeof input.colors.background === 'string' &&
    typeof input.colors.foreground === 'string' &&
    typeof input.colors.primary === 'string' &&
    typeof input.colors.border === 'string' &&
    typeof input.colors.muted === 'string'
  )
}

export function detectLegacyTheme(theme: CompatibleThemeInput): boolean {
  if (!isRecord(theme)) return true
  const colors = isRecord(theme.colors) ? theme.colors : undefined
  if (!colors) return true
  if (typeof colors.bg === 'string' || typeof colors.fg === 'string') return true
  if (typeof colors['--bg'] === 'string' || typeof colors['--foreground'] === 'string') return true
  return !hasSemanticTokens(theme)
}

export function mapLegacyToPrimitiveTokens(theme: CompatibleThemeInput): LegacyPrimitiveTokens {
  const colors = isRecord(theme) && isRecord(theme.colors) ? theme.colors : undefined
  return {
    bg: readColor(colors, 'background', 'bg', '--bg'),
    fg: readColor(colors, 'foreground', 'fg', '--fg', '--foreground'),
    primary: readColor(colors, 'primary', '--primary'),
    border: readColor(colors, 'border', '--border'),
    muted: readColor(colors, 'muted', '--muted'),
  }
}

export function bridgeLegacyCSSVariables(tokens: ThemeDefinition): Record<string, string> {
  return {
    '--bg': tokens.colors.background,
    '--fg': tokens.colors.foreground,
    '--foreground': tokens.colors.foreground,
    '--primary': tokens.colors.primary,
    '--border': tokens.colors.border,
    '--muted': tokens.colors.muted,
  }
}

export function normalizeThemeInput(theme: CompatibleThemeInput, base: ThemeDefinition = DEFAULT_THEME): ThemeDefinition {
  if (!isRecord(theme)) return base

  const primitive = mapLegacyToPrimitiveTokens(theme)
  const semantic = {
    background: primitive.bg,
    foreground: primitive.fg,
    primary: primitive.primary,
    border: primitive.border,
    muted: primitive.muted,
  }

  const id = typeof theme.id === 'string' && theme.id.trim() ? theme.id.trim() : base.id
  const name = typeof theme.name === 'string' && theme.name.trim() ? theme.name.trim() : base.name
  const label = typeof theme.label === 'string' && theme.label.trim() ? theme.label.trim() : undefined
  const family = typeof theme.family === 'string' && theme.family.trim() ? theme.family.trim() : undefined
  const variant = theme.variant === 'light' || theme.variant === 'dark' || theme.variant === 'auto' ? theme.variant : undefined
  const radius = isRecord(theme.radius) ? theme.radius : undefined
  const spacing = isRecord(theme.spacing) ? theme.spacing : undefined

  return mergeThemeDefinition(
    {
      id,
      name,
      ...(label ? { label } : {}),
      ...(family ? { family } : {}),
      ...(variant ? { variant } : {}),
      ...(typeof theme.builtIn === 'boolean' ? { builtIn: theme.builtIn } : {}),
      colors: semantic,
      radius: {
        ...(typeof radius?.card === 'number' ? { card: radius.card } : {}),
        ...(typeof radius?.control === 'number' ? { control: radius.control } : {}),
      },
      spacing: {
        ...(typeof spacing?.row === 'number' ? { row: spacing.row } : {}),
        ...(typeof spacing?.section === 'number' ? { section: spacing.section } : {}),
      },
    },
    base,
  )
}
