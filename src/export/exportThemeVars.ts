import type { UiLocaleId } from '../i18n/resolveLocale'
import type { ExportThemeSnapshot } from './exportThemeSnapshot'
import { exportFontStackForLocale } from './exportLocaleTypography'

/** PDF / Self-contained export of HTML semantic tokens (with no App Theme Runtime)*/
function buildExportThemeTokens(localeId: UiLocaleId): Record<string, string> {
  const fontUi = exportFontStackForLocale(localeId)
  return {
  '--surface-app': '#ffffff',
  '--surface-editor': '#ffffff',
  '--surface-panel': '#f6f8fa',
  '--surface-preview': '#ffffff',
  '--surface-hover': '#f3f4f6',
  '--text-primary': '#24292f',
  '--text-secondary': '#57606a',
  '--text-tertiary': '#6e7781',
  '--text-muted': '#6e7781',
  '--border-subtle': '#d0d7de',
  '--border-strong': '#8c959f',
  '--accent': '#0969da',
  '--font-ui': fontUi,
  '--font-reading': fontUi,
  '--font-mono': 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  '--line-reading': '1.7',
  '--letter-reading': '0',
  '--code-bg': '#f6f8fa',
  '--code-lang-bg': '#eef2f6',
  '--code-lang-fg': '#57606a',
  '--code-gutter-bg': '#f1f4f8',
  '--code-gutter-fg': '#6e7781',
  '--hairline': '1px',
  '--radius-sm': '6px',
  '--radius-lg': '12px',
  '--shadow-soft': '0 10px 24px rgba(0, 0, 0, 0.08)',
  }
}

const EXPORT_THEME_LIGHT_BASE = buildExportThemeTokens('en')

function buildExportThemeDark(localeId: UiLocaleId): Record<string, string> {
  const fontUi = exportFontStackForLocale(localeId)
  return {
  '--surface-app': '#0d1117',
  '--surface-editor': '#0d1117',
  '--surface-panel': '#161b22',
  '--surface-preview': '#0d1117',
  '--surface-hover': '#21262d',
  '--text-primary': '#e6edf3',
  '--text-secondary': '#8b949e',
  '--text-tertiary': '#6e7681',
  '--text-muted': '#8b949e',
  '--border-subtle': '#30363d',
  '--border-strong': '#484f58',
  '--accent': '#58a6ff',
  '--font-ui': fontUi,
  '--font-reading': fontUi,
  '--font-mono': 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  '--line-reading': '1.7',
  '--letter-reading': '0',
  '--code-bg': '#161b22',
  '--code-lang-bg': '#21262d',
  '--code-lang-fg': '#8b949e',
  '--code-gutter-bg': '#161b22',
  '--code-gutter-fg': '#6e7681',
  '--hairline': '1px',
  '--radius-sm': '6px',
  '--radius-lg': '12px',
  '--shadow-soft': '0 14px 28px rgba(0, 0, 0, 0.28)',
  }
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

function buildExportThemeFromSnapshot(snapshot: ExportThemeSnapshot): Record<string, string> {
  const localeId = snapshot.localeId ?? 'en'
  const fontUi = exportFontStackForLocale(localeId)
  const { colors, radius } = snapshot.theme
  const dark = snapshot.dark
  return {
    '--surface-app': colors.background,
    '--surface-editor': colors.background,
    '--surface-panel': translucent(colors.background, dark ? 0.92 : 0.96),
    '--surface-preview': colors.background,
    '--surface-hover': translucent(colors.foreground, dark ? 0.08 : 0.06),
    '--text-primary': colors.foreground,
    '--text-secondary': colors.muted,
    '--text-tertiary': colors.muted,
    '--text-muted': colors.muted,
    '--border-subtle': colors.border,
    '--border-strong': colors.border,
    '--accent': colors.primary,
    '--font-ui': fontUi,
    '--font-reading': fontUi,
    '--font-mono': 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    '--line-reading': '1.7',
    '--letter-reading': '0',
    '--code-bg': dark ? '#161b22' : '#f6f8fa',
    '--code-lang-bg': dark ? '#21262d' : '#eef2f6',
    '--code-lang-fg': dark ? '#8b949e' : '#57606a',
    '--code-gutter-bg': dark ? '#161b22' : '#f1f4f8',
    '--code-gutter-fg': dark ? '#6e7681' : '#6e7781',
    '--hairline': '1px',
    '--radius-sm': `${Math.max(4, radius.control - 4)}px`,
    '--radius-lg': `${radius.card}px`,
    '--shadow-soft': dark ? '0 14px 28px rgba(0, 0, 0, 0.28)' : '0 10px 24px rgba(0, 0, 0, 0.08)',
  }
}

function formatTokenBlock(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
}

/** Inject export page semantic CSS variables for table/callout/color-mix rule parsing*/
export function buildExportThemeVarsCss(opts?: {
  localeId?: UiLocaleId
  snapshot?: ExportThemeSnapshot
}): string {
  const localeId = opts?.localeId
  const snapshot = opts?.snapshot
  const light = snapshot && !snapshot.dark
    ? buildExportThemeFromSnapshot(snapshot)
    : localeId
      ? buildExportThemeTokens(localeId)
      : EXPORT_THEME_LIGHT_BASE
  const dark = snapshot && snapshot.dark
    ? buildExportThemeFromSnapshot(snapshot)
    : localeId
      ? buildExportThemeDark(localeId)
      : buildExportThemeDark('en')
  return `:root,
html.markdown-export-root,
body.markdown-export-root,
div.markdown-export-root {
${formatTokenBlock(light)}
}

body.markdown-export-root[data-theme='dark'],
div.markdown-export-root[data-theme='dark'] {
${formatTokenBlock(dark)}
}`
}
