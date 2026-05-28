export type MermaidThemeVariables = Record<string, string>

export type MermaidResolvedColors = {
  background: string
  panel: string
  elevated: string
  text: string
  border: string
  accent: string
}

export function mermaidColorsFromThemeVariables(vars: MermaidThemeVariables): MermaidResolvedColors {
  const pick = (...values: Array<string | undefined>) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim() && !value.startsWith('var(')) return value
    }
    return '#212529'
  }
  return {
    background: pick(vars.background, vars.mainBkg),
    panel: pick(vars.primaryColor, vars.mainBkg, vars.actorBkg),
    elevated: pick(vars.secondBkg, vars.tertiaryColor, vars.clusterBkg, vars.noteBkgColor),
    text: pick(vars.textColor, vars.primaryTextColor, vars.nodeTextColor),
    border: pick(vars.primaryBorderColor, vars.lineColor, vars.nodeBorder),
    accent: pick(vars.secondaryColor, vars.mindmapBranchColor),
  }
}

export const MERMAID_THEME_TOKEN_MAP = {
  background: ['--color-bg-surface', '--surface-app'],
  mainBkg: ['--color-surface-panel', '--color-bg-panel', '--surface-panel'],
  secondBkg: ['--color-bg-elevated', '--color-bg-panel', '--surface-panel'],
  primaryColor: ['--color-surface-panel', '--color-bg-panel', '--surface-panel'],
  primaryTextColor: '--color-text-primary',
  primaryBorderColor: '--color-border-subtle',
  lineColor: '--color-border-subtle',
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
  signalColor: '--color-border-subtle',
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
export const MERMAID_CSS_ACCENT = 'var(--color-accent-primary, var(--accent))'
