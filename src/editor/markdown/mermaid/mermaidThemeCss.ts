import {
  MERMAID_CSS_BACKGROUND,
  MERMAID_CSS_ACCENT,
  MERMAID_CSS_BORDER,
  MERMAID_CSS_EDGE,
  MERMAID_CSS_ELEVATED,
  MERMAID_CSS_PANEL,
  MERMAID_CSS_TEXT,
  type MermaidResolvedColors,
} from './mermaidThemeTokens'

function resolveMermaidCssColors(colors?: MermaidResolvedColors) {
  return {
    background: colors?.background ?? MERMAID_CSS_BACKGROUND,
    panel: colors?.panel ?? MERMAID_CSS_PANEL,
    elevated: colors?.elevated ?? MERMAID_CSS_ELEVATED,
    text: colors?.text ?? MERMAID_CSS_TEXT,
    border: colors?.border ?? MERMAID_CSS_BORDER,
    edge: colors?.edge ?? MERMAID_CSS_EDGE,
    accent: colors?.accent ?? MERMAID_CSS_ACCENT,
  }
}

/** CSS bridge for Mermaid DOM that themeVariables cannot fully control. */
export function buildMermaidThemeCss(colors?: MermaidResolvedColors): string {
  const c = resolveMermaidCssColors(colors)
  return `
    .mermaid,
    .mermaid svg,
    svg {
      background: ${c.background} !important;
      background-color: ${c.background} !important;
    }
    .mermaid foreignObject,
    foreignObject {
      background: transparent !important;
      background-color: transparent !important;
    }
    .mermaid .nodeLabel,
    .mermaid .edgeLabel,
    .mermaid .label,
    .nodeLabel,
    .edgeLabel,
    .label {
      color: ${c.text} !important;
      background: transparent !important;
      background-color: transparent !important;
      white-space: nowrap !important;
      text-align: center !important;
      word-break: keep-all !important;
      overflow-wrap: normal !important;
      line-height: 1.35 !important;
    }
    .mermaid .labelBox,
    .labelBox {
      background: ${c.background} !important;
      background-color: ${c.background} !important;
      fill: ${c.background} !important;
      stroke: ${c.border} !important;
    }
    .mermaid .nodeLabel text,
    .mermaid .label text,
    .mermaid text,
    .mermaid tspan,
    .nodeLabel text,
    .label text,
    text,
    tspan {
      font-size: 13px !important;
      fill: ${c.text} !important;
    }
    .mermaid foreignObject div,
    .mermaid foreignObject span,
    .mermaid foreignObject p,
    foreignObject div,
    foreignObject span,
    foreignObject p {
      font-size: 13px !important;
      color: ${c.text} !important;
      background: ${c.panel} !important;
      background-color: ${c.panel} !important;
      white-space: nowrap !important;
      word-break: keep-all !important;
      overflow-wrap: normal !important;
      line-height: 1.35 !important;
      display: inline-block !important;
    }
    .mermaid .edgePath path,
    .mermaid .edgePaths path,
    .mermaid .edges path,
    .mermaid .flowchart-link,
    .mermaid .messageLine0,
    .mermaid .messageLine1,
    .mermaid .actor-line,
    .edgePath path,
    .edgePaths path,
    .edges path,
    .flowchart-link,
    .messageLine0,
    .messageLine1,
    .actor-line {
      stroke: ${c.edge} !important;
      stroke-width: 1.75px !important;
    }
    .mermaid marker path,
    .mermaid defs marker path,
    marker path {
      fill: ${c.edge} !important;
      stroke: ${c.edge} !important;
    }
    .mermaid .cluster rect,
    .cluster rect {
      fill: ${c.elevated} !important;
      stroke: ${c.border} !important;
    }
    .mermaid .node rect,
    .mermaid .node polygon,
    .mermaid .node circle,
    .node rect,
    .node polygon,
    .node circle {
      fill: ${c.panel} !important;
      stroke: ${c.border} !important;
    }
    .mermaid .actor,
    .actor {
      stroke: ${c.border} !important;
      fill: ${c.panel} !important;
    }
    .mermaid .messageText,
    .mermaid .loopText,
    .mermaid .noteText,
    .messageText,
    .loopText,
    .noteText {
      font-size: 13px !important;
      fill: ${c.text} !important;
    }
    .mermaid .note rect,
    .note rect {
      fill: ${c.elevated} !important;
      stroke: ${c.border} !important;
    }
    .mermaid .mindmap-node rect,
    .mermaid .mindmap-node circle,
    .mermaid .mindmap-node polygon,
    .mermaid .pm-mindmap-node rect,
    .mermaid .pm-mindmap-node circle,
    .mermaid .pm-mindmap-node polygon,
    .mindmap-node rect,
    .mindmap-node circle,
    .mindmap-node polygon,
    .pm-mindmap-node rect,
    .pm-mindmap-node circle,
    .pm-mindmap-node polygon {
      fill: ${c.elevated} !important;
      stroke: ${c.border} !important;
    }
    .mermaid .mindmap-node text,
    .mermaid .mindmap-node tspan,
    .mermaid .pm-mindmap-node text,
    .mermaid .pm-mindmap-node tspan,
    .mindmap-node text,
    .mindmap-node tspan,
    .pm-mindmap-node text,
    .pm-mindmap-node tspan {
      fill: ${c.text} !important;
      color: ${c.text} !important;
    }
    .mermaid .mindmap-link,
    .mermaid .pm-mindmap-link,
    .mermaid .pm-mindmap-edges path,
    .mindmap-link,
    .pm-mindmap-link,
    .pm-mindmap-edges path {
      stroke: ${c.accent} !important;
    }
    .mermaid .pm-mindmap-svg,
    .mermaid .pm-mindmap-preview-host,
    .pm-mindmap-svg,
    .pm-mindmap-preview-host {
      background: ${c.background} !important;
      background-color: ${c.background} !important;
    }
  `.trim()
}
