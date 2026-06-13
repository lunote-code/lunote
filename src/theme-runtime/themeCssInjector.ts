import type { ThemeDefinition } from './themeTypes'
import { bridgeLegacyCSSVariables, normalizeThemeInput } from './themeCompatibilityLayer'

const TOKEN_STYLE_TAG_ID = 'luna-theme-tokens'

const APPLIED_VARIABLES = [
  '--color-bg-surface',
  '--color-bg-panel',
  '--color-bg-elevated',
  '--color-surface-panel',
  '--color-bg-editor',
  '--color-text-primary',
  '--color-text-muted',
  '--color-text-tertiary',
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
  '--text-tertiary',
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
  '--surface-elevated',
  '--shadow-soft',
  '--shadow-panel',
  '--code-bg',
  '--code-gutter-fg',
  '--code-gutter-bg',
  '--code-lang-fg',
  '--code-lang-bg',
  '--inline-code-bg',
] as const

export type ApplyThemeCssOptions = {
  /** When true, token variables are omitted so external CSS can own the palette. */
  externalCssActive?: boolean
  themePreset?: string
  themeMode?: 'light' | 'dark'
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

function parseHexRgb(value: string): [number, number, number] | null {
  if (!value.startsWith('#')) return null
  const hex = value.slice(1)
  if (hex.length !== 6) return null
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return [r, g, b]
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixHex(base: string, target: string, ratio: number): string {
  const a = parseHexRgb(base)
  const b = parseHexRgb(target)
  if (!a || !b) return base
  const t = Math.max(0, Math.min(1, ratio))
  return toHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ])
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildTokenSelector(preset: string, mode: 'light' | 'dark'): string {
  const presetAttr = escapeCssString(preset)
  const modeAttr = escapeCssString(mode)
  return `html:not([data-theme-css-file])[data-theme-preset='${presetAttr}'][data-theme='${modeAttr}']`
}

function buildTokenModeSelector(mode: 'light' | 'dark'): string {
  const modeAttr = escapeCssString(mode)
  return `html:not([data-theme-css-file])[data-theme='${modeAttr}']`
}

function shadowTokensForMode(mode: 'light' | 'dark'): { soft: string; panel: string } {
  if (mode === 'light') {
    return {
      soft: '0 1px 2px rgba(31, 35, 40, 0.06)',
      panel: '0 8px 24px rgba(31, 35, 40, 0.08)',
    }
  }
  return {
    soft: '0 1px 3px rgba(0, 0, 0, 0.45)',
    panel: '0 12px 40px rgba(0, 0, 0, 0.55)',
  }
}

function buildThemeTokenStylesheet(
  theme: ThemeDefinition,
  preset: string,
  mode: 'light' | 'dark',
): string {
  const compatibleTheme = normalizeThemeInput(theme)
  const { colors, radius, spacing } = compatibleTheme
  const panel = translucent(colors.background, 0.92)
  const hover = translucent(colors.foreground, 0.08)
  const legacy = bridgeLegacyCSSVariables(compatibleTheme)
  const shadows = shadowTokensForMode(mode)
  const codeBg = mixHex(colors.background, colors.foreground, mode === 'light' ? 0.03 : 0.1)
  const codeGutterBg = mixHex(codeBg, colors.foreground, mode === 'light' ? 0.06 : 0.14)
  const codeGutterFg = mixHex(colors.foreground, colors.background, mode === 'light' ? 0.35 : 0.28)
  const inlineCodeBg = mixHex(codeBg, colors.foreground, mode === 'light' ? 0.05 : 0.12)

  const vars: Record<string, string> = {
    '--color-bg-surface': colors.background,
    '--color-bg-panel': panel,
    '--color-bg-elevated': panel,
    '--color-surface-panel': panel,
    '--color-bg-editor': colors.background,
    '--color-text-primary': colors.foreground,
    '--color-text-muted': colors.muted,
    '--color-text-tertiary': colors.muted,
    '--color-accent-primary': colors.primary,
    '--color-border-subtle': colors.border,
    ...legacy,
    '--surface-app': colors.background,
    '--surface': colors.background,
    '--surface-panel': panel,
    '--surface-editor': colors.background,
    '--surface-preview': colors.background,
    '--surface-hover': hover,
    '--text-primary': colors.foreground,
    '--text-secondary': colors.muted,
    '--text-muted': colors.muted,
    '--text-tertiary': colors.muted,
    '--border-subtle': colors.border,
    '--border-strong': colors.border,
    '--accent': colors.primary,
    '--link': colors.primary,
    '--link-hover': colors.primary,
    '--link-visited': colors.primary,
    '--focus-ring': translucent(colors.primary, 0.22),
    '--input-bg': colors.background,
    '--panel': panel,
    '--panel-header': panel,
    '--radius': `${radius.control}px`,
    '--radius-md': `${radius.control}px`,
    '--radius-xl': `${radius.card}px`,
    '--settings-card-radius': `${radius.card}px`,
    '--settings-control-radius': `${radius.control}px`,
    '--settings-section-gap': `${spacing.section}px`,
    '--settings-row-gap': `${spacing.row}px`,
    '--surface-elevated': panel,
    '--shadow-soft': shadows.soft,
    '--shadow-panel': shadows.panel,
    ...(!theme.builtIn
      ? {
          '--code-bg': codeBg,
          '--code-gutter-fg': codeGutterFg,
          '--code-gutter-bg': codeGutterBg,
          '--code-lang-fg': codeGutterFg,
          '--code-lang-bg': codeGutterBg,
          '--inline-code-bg': inlineCodeBg,
        }
      : {}),
  }

  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  const blocks = [`${buildTokenSelector(preset, mode)} {\n${body}\n}`]
  if (!theme.builtIn) {
    blocks.push(`${buildTokenModeSelector(mode)} {\n${body}\n}`)
  }
  return `${blocks.join('\n')}\n`
}

function setTokenStyleTagContent(css: string): void {
  if (typeof document === 'undefined') return
  let style = document.getElementById(TOKEN_STYLE_TAG_ID) as HTMLStyleElement | null
  if (!css.trim()) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = TOKEN_STYLE_TAG_ID
    const externalStyle = document.getElementById('luna-user-theme-css')
    if (externalStyle?.parentNode) {
      externalStyle.parentNode.insertBefore(style, externalStyle)
    } else {
      document.head.appendChild(style)
    }
  }
  style.textContent = css
}

/** Remove legacy inline token variables from a previous runtime version. */
export function removeThemeTokens(root: HTMLElement = document.documentElement): void {
  for (const name of APPLIED_VARIABLES) {
    root.style.removeProperty(name)
  }
}

export function clearThemeTokenStyles(): void {
  removeThemeTokens()
  setTokenStyleTagContent('')
}

export function applyThemeCssVariables(
  theme: ThemeDefinition,
  options: ApplyThemeCssOptions = {},
  root: HTMLElement = document.documentElement,
): void {
  removeThemeTokens(root)

  if (options.externalCssActive) {
    // Palette tokens come from external CSS; mode-derived tokens still apply via
    // static src/theme/modeThemeTokens.css (html[data-theme] selectors).
    setTokenStyleTagContent('')
    return
  }

  const preset = options.themePreset ?? 'github'
  const mode = options.themeMode ?? 'dark'
  setTokenStyleTagContent(buildThemeTokenStylesheet(theme, preset, mode))
}
