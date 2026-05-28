import { buildMermaidInitializeOptions } from '../theme/buildMermaidInitializeOptions'
import { buildMermaidThemeCss } from '../editor/markdown/mermaid/mermaidThemeCss'
import {
  mermaidColorsFromThemeVariables,
  type MermaidResolvedColors,
  type MermaidThemeVariables,
} from '../editor/markdown/mermaid/mermaidThemeTokens'

/** Mermaid/khroma cannot parse `var(--token)`; use readable hex when exporting*/
export const MERMAID_EXPORT_THEME_FALLBACKS_LIGHT: MermaidThemeVariables = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '13px',
  background: '#ffffff',
  mainBkg: '#f8f9fa',
  primaryColor: '#f8f9fa',
  primaryTextColor: '#212529',
  primaryBorderColor: '#dee2e6',
  lineColor: '#dee2e6',
  textColor: '#212529',
  secondaryColor: '#4dabf7',
  tertiaryColor: '#f1f3f5',
  tertiaryTextColor: '#212529',
}

export const MERMAID_EXPORT_THEME_FALLBACKS_DARK: MermaidThemeVariables = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '13px',
  background: '#0d1117',
  mainBkg: '#161b22',
  primaryColor: '#161b22',
  primaryTextColor: '#c9d1d9',
  primaryBorderColor: '#30363d',
  lineColor: '#30363d',
  textColor: '#c9d1d9',
  secondaryColor: '#58a6ff',
  tertiaryColor: '#21262d',
  tertiaryTextColor: '#c9d1d9',
}

export function resolveMermaidThemeVariablesForExport(dark = false): MermaidThemeVariables {
  return dark ? { ...MERMAID_EXPORT_THEME_FALLBACKS_DARK } : { ...MERMAID_EXPORT_THEME_FALLBACKS_LIGHT }
}

export function resolveMermaidExportColors(dark = false): MermaidResolvedColors {
  return mermaidColorsFromThemeVariables(resolveMermaidThemeVariablesForExport(dark))
}

/** Headless Chrome PDF cannot reliably paint foreignObject labels — use native SVG text. */
export function buildMermaidExportInitializeOptions(dark = false): Record<string, unknown> {
  const colors = resolveMermaidExportColors(dark)
  const base = buildMermaidInitializeOptions(dark) as Record<string, unknown>
  const flowchart = (base.flowchart ?? {}) as Record<string, unknown>
  return {
    ...base,
    htmlLabels: false,
    themeCSS: buildMermaidThemeCss(colors),
    themeVariables: resolveMermaidThemeVariablesForExport(dark),
    flowchart: {
      ...flowchart,
      htmlLabels: false,
    },
  }
}

export function buildMermaidExportLayoutCss(colors: MermaidResolvedColors): string {
  return `
.markdown-body.markdown-export-body .mermaid-export-diagram {
  margin: 1rem 0;
  padding: 0.75rem;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: ${colors.background};
  overflow-x: auto;
}
.markdown-body.markdown-export-body .mermaid-export-diagram svg {
  display: block;
  max-width: 100%;
  height: auto;
  background: ${colors.background};
}
.markdown-body.markdown-export-body .mermaid-export-diagram svg text,
.markdown-body.markdown-export-body .mermaid-export-diagram svg tspan {
  fill: ${colors.text};
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
  font-size: 13px;
}
`.trim()
}
