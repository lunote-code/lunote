export type MermaidThemeVariables = Record<string, string>

export type MermaidResolvedColors = {
  background: string
  panel: string
  elevated: string
  text: string
  /** Node / cluster outlines */
  border: string
  /** Flowchart & sequence connectors (higher contrast than border-subtle) */
  edge: string
  accent: string
}

const MERMAID_COLOR_FALLBACKS_LIGHT: MermaidResolvedColors = {
  background: '#ffffff',
  panel: '#f3f4f6',
  elevated: '#e9ecef',
  text: '#212529',
  border: '#ced4da',
  edge: '#495057',
  accent: '#0d6efd',
}

const MERMAID_COLOR_FALLBACKS_DARK: MermaidResolvedColors = {
  background: '#0d1117',
  panel: '#161b22',
  elevated: '#21262d',
  text: '#c9d1d9',
  border: '#30363d',
  edge: '#8b949e',
  accent: '#58a6ff',
}

function pickResolved(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() && !value.startsWith('var(')) return value
  }
  return undefined
}

function resolveWithFallback(
  values: Array<string | undefined>,
  fallback: MermaidResolvedColors,
  key: keyof MermaidResolvedColors,
): string {
  return pickResolved(...values) ?? fallback[key]
}

export function mermaidColorsFromThemeVariables(vars: MermaidThemeVariables): MermaidResolvedColors {
  const background = pickResolved(vars.background, vars.mainBkg)
  const fallback =
    background && normalizeColor(background) === '#0d1117'
      ? MERMAID_COLOR_FALLBACKS_DARK
      : MERMAID_COLOR_FALLBACKS_LIGHT

  return {
    background: resolveWithFallback([vars.background, vars.mainBkg], fallback, 'background'),
    panel: resolveWithFallback([vars.primaryColor, vars.mainBkg, vars.actorBkg], fallback, 'panel'),
    elevated: resolveWithFallback(
      [vars.secondBkg, vars.tertiaryColor, vars.clusterBkg, vars.noteBkgColor],
      fallback,
      'elevated',
    ),
    text: resolveWithFallback([vars.textColor, vars.primaryTextColor, vars.nodeTextColor], fallback, 'text'),
    border: resolveWithFallback(
      [vars.primaryBorderColor, vars.nodeBorder, vars.clusterBorder, vars.actorBorder],
      fallback,
      'border',
    ),
    edge: resolveWithFallback(
      [vars.lineColor, vars.signalColor, vars.primaryBorderColor],
      fallback,
      'edge',
    ),
    accent: resolveWithFallback([vars.secondaryColor, vars.mindmapBranchColor], fallback, 'accent'),
  }
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export const MERMAID_THEME_TOKEN_MAP = {
  background: ['--color-bg-surface', '--surface-app'],
  mainBkg: ['--color-surface-panel', '--color-bg-panel', '--surface-panel'],
  secondBkg: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  primaryColor: ['--color-surface-panel', '--color-bg-panel', '--surface-panel'],
  primaryTextColor: '--color-text-primary',
  primaryBorderColor: '--color-border-subtle',
  lineColor: ['--color-text-muted', '--text-muted', '--color-border-subtle'],
  clusterBkg: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  clusterBorder: '--color-border-subtle',
  edgeLabelBackground: '--color-bg-surface',
  textColor: '--color-text-primary',
  nodeTextColor: '--color-text-primary',
  nodeBorder: '--color-border-subtle',
  titleColor: '--color-text-primary',
  actorBkg: ['--color-surface-panel', '--color-bg-panel', '--surface-panel'],
  actorBorder: '--color-border-subtle',
  actorTextColor: '--color-text-primary',
  signalColor: ['--color-text-muted', '--text-muted', '--color-border-subtle'],
  labelBoxBkgColor: '--color-bg-surface',
  labelBoxBorderColor: '--color-border-subtle',
  labelTextColor: '--color-text-primary',
  loopTextColor: '--color-text-primary',
  noteBkgColor: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  noteTextColor: '--color-text-primary',
  noteBorderColor: '--color-border-subtle',
  mindmapBranchColor: '--color-accent-primary',
  mindmapNodeBkg: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  mindmapNodeBorderColor: '--color-border-subtle',
  mindmapTextColor: '--color-text-primary',
} as const

export const MERMAID_ACCENT_THEME_TOKEN_MAP = {
  secondaryColor: '--color-accent-primary',
  tertiaryColor: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  tertiaryTextColor: '--color-text-primary',
} as const

export const MERMAID_CSS_BACKGROUND = 'var(--color-bg-surface, var(--surface-app))'
export const MERMAID_CSS_PANEL = 'var(--color-surface-panel, var(--color-bg-panel, var(--surface-panel)))'
export const MERMAID_CSS_ELEVATED = 'var(--color-bg-elevated, var(--color-bg-panel, var(--surface-panel)))'
export const MERMAID_CSS_TEXT = 'var(--color-text-primary, var(--text-primary))'
export const MERMAID_CSS_BORDER = 'var(--color-border-subtle, var(--border-subtle))'
export const MERMAID_CSS_EDGE = 'var(--color-text-muted, var(--text-muted, var(--border-subtle)))'
export const MERMAID_CSS_ACCENT = 'var(--color-accent-primary, var(--accent))'
