import type { Config } from 'dompurify'
import { sanitizeEmbeddedHtml } from '../lunaHtmlSanitize'

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

function stripObviousSvgXss(svg: string): string {
  let out = svg.replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  return out
}

function sanitizeForeignObjectInner(svg: string): string {
  if (typeof DOMParser === 'undefined') return svg
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    doc.querySelectorAll('foreignObject').forEach((fo) => {
      fo.innerHTML = sanitizeEmbeddedHtml(fo.innerHTML)
    })
    return new XMLSerializer().serializeToString(doc)
  } catch {
    return svg
  }
}

/** Light sanitize: preserve Mermaid SVG structure; strip scripts/handlers and DOMPurify foreignObject HTML. */
export function sanitizeMermaidSvgHtml(svg: string): string {
  return sanitizeForeignObjectInner(stripObviousSvgXss(svg))
}
