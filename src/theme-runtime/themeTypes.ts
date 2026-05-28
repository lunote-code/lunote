export type ThemeColorTokens = {
  background: string
  foreground: string
  primary: string
  border: string
  muted: string
}

export type ThemeRadiusTokens = {
  card: number
  control: number
}

export type ThemeSpacingTokens = {
  row: number
  section: number
}

export type ThemeAppearanceVariant = 'light' | 'dark' | 'auto'

export type ThemeDefinition = {
  id: string
  name: string
  label?: string
  family?: string
  variant?: ThemeAppearanceVariant
  colors: ThemeColorTokens
  radius: ThemeRadiusTokens
  spacing: ThemeSpacingTokens
  builtIn?: boolean
}

export type ThemeToken = keyof ThemeColorTokens | keyof ThemeRadiusTokens | keyof ThemeSpacingTokens

export type BuiltInTheme = ThemeDefinition & {
  builtIn: true
}

export type UserTheme = ThemeDefinition & {
  builtIn?: false
  sourceName?: string
}

export type RawThemeDefinition = {
  id?: unknown
  name?: unknown
  colors?: Partial<Record<keyof ThemeColorTokens | 'bg' | 'fg' | 'primary' | 'border' | 'muted' | '--bg' | '--fg' | '--foreground' | '--primary' | '--border' | '--muted', unknown>>
  radius?: Partial<Record<keyof ThemeRadiusTokens, unknown>>
  spacing?: Partial<Record<keyof ThemeSpacingTokens, unknown>>
}
