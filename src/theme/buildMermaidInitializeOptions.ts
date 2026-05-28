import { mindmapTheme } from './mindmapTheme'
import { mermaidLayoutConfig } from './mermaidLayoutConfig'
import { buildMermaidThemeCss } from '../editor/markdown/mermaid/mermaidThemeCss'
import {
  buildMermaidThemeVariables,
  resolveMermaidEditorColors,
} from '../editor/markdown/mermaid/mermaidThemeBridge'

/**
 * Mermaid initialization: colors are mapped from Theme Runtime semantic tokens, which follow the global theme at runtime.
 */
export function buildMermaidInitializeOptions(isDark = false): Record<string, unknown> {
  void isDark
  const layout = mermaidLayoutConfig
  const editorColors = typeof window !== 'undefined' ? resolveMermaidEditorColors() : undefined

  return {
    startOnLoad: false,
    /** Block script injection in diagram source; SVG is still sanitized before innerHTML. */
    securityLevel: 'antiscript',
    theme: 'base',
    htmlLabels: true,
    themeCSS: buildMermaidThemeCss(editorColors),
    themeVariables: buildMermaidThemeVariables(),
    flowchart: {
      defaultRenderer: layout.flowchartRenderer,
      curve: mindmapTheme.curveStyle,
      padding: layout.padding,
      nodeSpacing: layout.nodeSpacing,
      rankSpacing: layout.rankSpacing,
      wrappingWidth: layout.wrappingWidth,
      useMaxWidth: false,
    },
    sequence: {
      diagramMarginX: layout.padding,
      diagramMarginY: layout.padding,
      boxMargin: layout.padding,
      messageMargin: layout.rankSpacing / 2,
      useMaxWidth: false,
      wrap: false,
    },
    state: {
      useMaxWidth: false,
      padding: layout.padding,
    },
    class: {
      useMaxWidth: false,
      padding: layout.padding,
    },
    er: {
      useMaxWidth: false,
    },
    journey: {
      useMaxWidth: false,
    },
  }
}
