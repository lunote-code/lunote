/**
 * Tile rendering unified theme (Mindmap / Mermaid / other graph preview only token source)
 * The editing layer only retains the AST; the visuals are controlled by this theme.
 */
export const mindmapTheme = {
  nodePadding: 12,
  levelSpacing: 40,
  siblingGap: 28,
  curveStyle: 'smooth' as const,
  fontSize: 13,
  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
  borderRadius: 8,
  nodeRadius: 8,
  colors: {
    level1: 'var(--color-text-primary, var(--text-primary))',
    level2: 'var(--color-text-primary, var(--text-primary))',
    level3: 'var(--color-text-primary, var(--text-primary))',
    edge: 'var(--color-accent-primary, var(--accent))',
    fill1: 'var(--color-bg-elevated, var(--color-bg-panel, var(--surface-panel)))',
    fill2: 'var(--color-bg-elevated, var(--color-bg-panel, var(--surface-panel)))',
    background: 'var(--color-bg-surface, var(--surface-app))',
  },
} as const

export type MindmapTheme = typeof mindmapTheme
