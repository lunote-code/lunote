import { mindmapTheme } from './mindmapTheme'

/**
 * Mermaid layout unique configuration source (flowchart/sequence/graph).
 * Patching layout in CSS or post-render DOM is prohibited.
 */
export const mermaidLayoutConfig = {
  /** Maximum label width (px); too small will cause html labels to be arranged vertically one word per line*/
  wrappingWidth: 200,
  nodeSpacing: mindmapTheme.siblingGap,
  rankSpacing: mindmapTheme.levelSpacing,
  padding: mindmapTheme.nodePadding,
  flowchartRenderer: 'dagre-wrapper' as const,
} as const
