import DOMPurify from 'dompurify'
import type { Config } from 'dompurify'

/**
 * Mermaid output contains foreignObject + div/span tags; only svg profile strips inner text.
 */
export const MERMAID_SVG_DOMPURIFY_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: [
    'foreignObject',
    'div',
    'span',
    'p',
    'br',
    'style',
    'defs',
    'marker',
    'clipPath',
    'mask',
    'pattern',
    'linearGradient',
    'radialGradient',
    'stop',
    'title',
    'desc',
  ],
  ADD_ATTR: [
    'class',
    'style',
    'xmlns',
    'width',
    'height',
    'x',
    'y',
    'transform',
    'viewBox',
    'fill',
    'stroke',
    'd',
    'points',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x1',
    'y1',
    'x2',
    'y2',
    'text-anchor',
    'dominant-baseline',
    'font-family',
    'font-size',
    'font-weight',
    'opacity',
    'marker-end',
    'marker-start',
    'id',
    'role',
    'preserveAspectRatio',
  ],
}

export type SanitizeMermaidSvgOptions = {
  /**
   * SVG from `mermaid.render` after `securityLevel: 'antiscript'`.
   * DOMPurify's SVG profile strips `foreignObject` label text; skip sanitize for trusted renderer output.
   */
  trustedMermaidOutput?: boolean
}

export function sanitizeMermaidSvgHtml(svg: string, options?: SanitizeMermaidSvgOptions): string {
  if (options?.trustedMermaidOutput) return svg
  return String(DOMPurify.sanitize(svg, MERMAID_SVG_DOMPURIFY_CONFIG))
}
