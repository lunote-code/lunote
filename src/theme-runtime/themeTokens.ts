import type { BuiltInTheme, ThemeColorTokens, ThemeDefinition, ThemeRadiusTokens, ThemeSpacingTokens } from './themeTypes'

export const LIGHT_THEME: BuiltInTheme = {
  id: 'light',
  name: 'Light',
  label: 'Light',
  variant: 'light',
  builtIn: true,
  colors: {
    background: '#f6f8fa',
    foreground: '#1f2328',
    primary: '#576270',
    border: 'rgba(31, 35, 40, 0.12)',
    muted: '#818b98',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const DARK_THEME: BuiltInTheme = {
  id: 'dark',
  name: 'Dark',
  label: 'Dark',
  variant: 'dark',
  builtIn: true,
  colors: {
    background: '#0d1117',
    foreground: '#e6edf3',
    primary: '#8b949e',
    border: 'rgba(240, 246, 252, 0.1)',
    muted: '#6e7681',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const GITHUB_LIGHT_THEME: BuiltInTheme = {
  ...LIGHT_THEME,
  id: 'github-light',
  name: 'GitHub Light',
  label: 'GitHub',
  family: 'github',
  variant: 'light',
}

export const GITHUB_DARK_THEME: BuiltInTheme = {
  ...DARK_THEME,
  id: 'github-dark',
  name: 'GitHub Dark',
  label: 'GitHub',
  family: 'github',
  variant: 'dark',
}

export const IDEA_LIGHT_THEME: BuiltInTheme = {
  id: 'idea-light',
  name: 'IDEA Light',
  label: 'IDEA',
  family: 'idea',
  variant: 'light',
  builtIn: true,
  colors: {
    background: '#e8e8e8',
    foreground: '#080808',
    primary: '#2675bf',
    border: 'rgba(0, 0, 0, 0.12)',
    muted: '#7a7a7a',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const IDEA_DARK_THEME: BuiltInTheme = {
  id: 'idea-dark',
  name: 'IDEA Dark',
  label: 'IDEA',
  family: 'idea',
  variant: 'dark',
  builtIn: true,
  colors: {
    background: '#3c3f41',
    foreground: '#a9b7c6',
    primary: '#589df6',
    border: 'rgba(255, 255, 255, 0.1)',
    muted: '#787878',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const DIM_DARK_THEME: BuiltInTheme = {
  id: 'dim-dark',
  name: 'Dim Dark',
  label: 'Dim',
  family: 'dim',
  variant: 'dark',
  builtIn: true,
  colors: {
    background: '#0c0c0f',
    foreground: '#e4e4e7',
    primary: '#a78bfa',
    border: 'rgba(244, 244, 255, 0.08)',
    muted: '#787887',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const DIM_LIGHT_THEME: BuiltInTheme = {
  id: 'dim-light',
  name: 'Dim Light',
  label: 'dim-light',
  family: 'dim',
  variant: 'light',
  builtIn: true,
  colors: {
    background: '#eceef1',
    foreground: '#1c1c1e',
    primary: '#6366f1',
    border: 'rgba(15, 23, 42, 0.1)',
    muted: '#71717a',
  },
  radius: {
    card: 16,
    control: 10,
  },
  spacing: {
    row: 16,
    section: 28,
  },
}

export const DEFAULT_THEME = DARK_THEME

export const BUILT_IN_THEMES: readonly BuiltInTheme[] = [
  GITHUB_LIGHT_THEME,
  GITHUB_DARK_THEME,
  IDEA_LIGHT_THEME,
  IDEA_DARK_THEME,
  DIM_LIGHT_THEME,
  DIM_DARK_THEME,
]

export const THEME_CSS_VARIABLES: Record<string, keyof ThemeDefinition['colors']> = {
  '--bg': 'background',
  '--fg': 'foreground',
  '--primary': 'primary',
  '--border': 'border',
  '--muted': 'muted',
}

type PartialThemeDefinition = Partial<Omit<ThemeDefinition, 'colors' | 'radius' | 'spacing'>> & {
  colors?: Partial<ThemeColorTokens>
  radius?: Partial<ThemeRadiusTokens>
  spacing?: Partial<ThemeSpacingTokens>
}

export function mergeThemeDefinition(theme: PartialThemeDefinition, base: ThemeDefinition = DEFAULT_THEME): ThemeDefinition {
  return {
    ...base,
    ...theme,
    id: theme.id ?? base.id,
    name: theme.name ?? base.name,
    colors: {
      ...base.colors,
      ...theme.colors,
    },
    radius: {
      ...base.radius,
      ...theme.radius,
    },
    spacing: {
      ...base.spacing,
      ...theme.spacing,
    },
  }
}
