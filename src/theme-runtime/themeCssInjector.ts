import type { ThemeDefinition } from './themeTypes'
import { bridgeLegacyCSSVariables, normalizeThemeInput } from './themeCompatibilityLayer'

const APPLIED_VARIABLES = [
  '--color-bg-surface',
  '--color-bg-panel',
  '--color-bg-editor',
  '--color-text-primary',
  '--color-text-muted',
  '--color-accent-primary',
  '--color-border-subtle',
  '--bg',
  '--fg',
  '--foreground',
  '--primary',
  '--border',
  '--muted',
  '--surface-app',
  '--surface',
  '--surface-panel',
  '--surface-editor',
  '--surface-preview',
  '--surface-hover',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-subtle',
  '--border-strong',
  '--accent',
  '--link',
  '--link-hover',
  '--link-visited',
  '--focus-ring',
  '--input-bg',
  '--panel',
  '--panel-header',
  '--radius',
  '--radius-md',
  '--radius-xl',
  '--settings-card-radius',
  '--settings-control-radius',
  '--settings-section-gap',
  '--settings-row-gap',
  '--background-primary',
  '--background-primary-alt',
  '--background-secondary',
  '--background-secondary-alt',
  '--background-modifier-border',
  '--background-modifier-border-hover',
  '--background-modifier-hover',
  '--background-modifier-form-field',
  '--background-modifier-form-field-highlighted',
  '--background-modifier-box-shadow',
  '--background-accent',
  '--text-normal',
  '--text-faint',
  '--text-accent',
  '--text-accent-hover',
  '--interactive-accent',
  '--interactive-accent-hover',
  '--interactive-normal',
  '--text-on-accent',
  '--scrollbar-bg',
  '--scrollbar-thumb-bg',
  '--scrollbar-active-thumb-bg',
  '--font-interface-theme',
  '--font-text-theme',
  '--font-monospace-theme',
] as const

function set(root: HTMLElement, name: string, value: string): void {
  root.style.setProperty(name, value)
}

function translucent(hexOrColor: string, alpha: number): string {
  if (!hexOrColor.startsWith('#')) return hexOrColor
  const hex = hexOrColor.slice(1)
  if (hex.length !== 6) return hexOrColor
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function removeThemeTokens(root: HTMLElement = document.documentElement): void {
  for (const name of APPLIED_VARIABLES) {
    root.style.removeProperty(name)
  }
}

export function applyThemeCssVariables(theme: ThemeDefinition, root: HTMLElement = document.documentElement): void {
  removeThemeTokens(root)

  const compatibleTheme = normalizeThemeInput(theme)
  const { colors, radius, spacing } = compatibleTheme
  const panel = translucent(colors.background, 0.92)
  const hover = translucent(colors.foreground, 0.08)

  set(root, '--color-bg-surface', colors.background)
  set(root, '--color-bg-panel', panel)
  set(root, '--color-bg-editor', colors.background)
  set(root, '--color-text-primary', colors.foreground)
  set(root, '--color-text-muted', colors.muted)
  set(root, '--color-accent-primary', colors.primary)
  set(root, '--color-border-subtle', colors.border)

  for (const [name, value] of Object.entries(bridgeLegacyCSSVariables(compatibleTheme))) {
    set(root, name, value)
  }

  set(root, '--surface-app', colors.background)
  set(root, '--surface', colors.background)
  set(root, '--surface-panel', panel)
  set(root, '--surface-editor', colors.background)
  set(root, '--surface-preview', colors.background)
  set(root, '--surface-hover', hover)
  set(root, '--text-primary', colors.foreground)
  set(root, '--text-secondary', colors.muted)
  set(root, '--text-muted', colors.muted)
  set(root, '--border-subtle', colors.border)
  set(root, '--border-strong', colors.border)
  set(root, '--accent', colors.primary)
  set(root, '--link', colors.primary)
  set(root, '--link-hover', colors.primary)
  set(root, '--link-visited', colors.primary)
  set(root, '--focus-ring', translucent(colors.primary, 0.22))
  set(root, '--input-bg', colors.background)
  set(root, '--panel', panel)
  set(root, '--panel-header', panel)

  set(root, '--radius', `${radius.control}px`)
  set(root, '--radius-md', `${radius.control}px`)
  set(root, '--radius-xl', `${radius.card}px`)
  set(root, '--settings-card-radius', `${radius.card}px`)
  set(root, '--settings-control-radius', `${radius.control}px`)
  set(root, '--settings-section-gap', `${spacing.section}px`)
  set(root, '--settings-row-gap', `${spacing.row}px`)

  // Bridge the most common Obsidian community theme variables to Luna semantic tokens.
  set(root, '--background-primary', 'var(--surface-editor)')
  set(root, '--background-primary-alt', 'var(--surface-app)')
  set(root, '--background-secondary', 'var(--surface-panel)')
  set(root, '--background-secondary-alt', 'var(--surface-hover)')
  set(root, '--background-modifier-border', 'var(--border-subtle)')
  set(root, '--background-modifier-border-hover', 'var(--border-strong)')
  set(root, '--background-modifier-hover', 'var(--surface-hover)')
  set(root, '--background-modifier-form-field', 'var(--input-bg)')
  set(root, '--background-modifier-form-field-highlighted', 'var(--surface-hover)')
  set(root, '--background-modifier-box-shadow', 'var(--focus-ring)')
  set(root, '--background-accent', 'var(--accent)')
  set(root, '--text-normal', 'var(--text-primary)')
  set(root, '--text-faint', 'var(--text-secondary)')
  set(root, '--text-accent', 'var(--link)')
  set(root, '--text-accent-hover', 'var(--link-hover)')
  set(root, '--interactive-accent', 'var(--accent)')
  set(root, '--interactive-accent-hover', 'var(--link-hover)')
  set(root, '--interactive-normal', 'var(--surface-hover)')
  set(root, '--text-on-accent', 'var(--surface-app)')
  set(root, '--scrollbar-bg', 'transparent')
  set(root, '--scrollbar-thumb-bg', 'color-mix(in srgb, var(--text-muted) 38%, transparent)')
  set(root, '--scrollbar-active-thumb-bg', 'color-mix(in srgb, var(--accent) 42%, var(--text-muted) 28%)')
  set(root, '--font-interface-theme', 'var(--font-ui)')
  set(root, '--font-text-theme', 'var(--font-reading)')
  set(root, '--font-monospace-theme', 'var(--font-mono)')
}
