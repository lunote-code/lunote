import { resolveMermaidEditorColors } from './mermaidThemeBridge'
import type { MermaidResolvedColors } from './mermaidThemeTokens'

const MERMAID_FALLBACK_COLORS: MermaidResolvedColors = {
  background: '#ffffff',
  panel: '#f3f4f6',
  elevated: '#e9ecef',
  text: '#212529',
  border: '#ced4da',
  accent: '#0d6efd',
}

function resolveMermaidCssColors(colors?: MermaidResolvedColors): MermaidResolvedColors {
  if (colors) return colors
  if (typeof window !== 'undefined') {
    try {
      return resolveMermaidEditorColors()
    } catch {
      /*SSR/topic not ready*/
    }
  }
  return MERMAID_FALLBACK_COLORS
}

function normalizeColor(value: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function isWhite(value: string | null): boolean {
  const v = normalizeColor(value)
  return v === '#fff' || v === '#ffffff' || v === 'white' || v === 'rgb(255,255,255)'
}

function isBlack(value: string | null): boolean {
  const v = normalizeColor(value)
  return v === '#000' || v === '#000000' || v === 'black' || v === 'rgb(0,0,0)'
}

function isDefaultDarkStroke(value: string | null): boolean {
  const v = normalizeColor(value)
  return v === '#333' || v === '#333333' || v === '#222' || v === '#111827' || v === 'rgb(51,51,51)'
}

function isTextElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  return tag === 'text' || tag === 'tspan'
}

function isShapeElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  return tag === 'rect' || tag === 'circle' || tag === 'ellipse' || tag === 'polygon' || tag === 'path'
}

function isBranchElement(el: Element): boolean {
  return el.matches('.mindmap-link, .pm-mindmap-link, .pm-mindmap-edges path')
}

function isMindmapNodeShape(el: Element): boolean {
  return el.matches('.mindmap-node rect, .mindmap-node circle, .mindmap-node polygon, .pm-mindmap-node rect, .pm-mindmap-node circle, .pm-mindmap-node polygon')
}

function resolveVarColor(value: string, colors: ReturnType<typeof resolveMermaidCssColors>): string | null {
  const v = value.trim()
  if (!v.startsWith('var(')) return null
  if (v.includes('--color-text-primary') || v.includes('--text-primary')) return colors.text
  if (v.includes('--color-bg-surface') || v.includes('--surface-app')) return colors.background
  if (
    v.includes('--color-surface-panel') ||
    v.includes('--color-bg-panel') ||
    v.includes('--surface-panel') ||
    v.includes('--actor')
  ) {
    return colors.panel
  }
  if (v.includes('--color-bg-elevated') || v.includes('--cluster') || v.includes('--note')) return colors.elevated
  if (v.includes('--color-border-subtle') || v.includes('--border-subtle') || v.includes('--line')) {
    return colors.border
  }
  if (v.includes('--color-accent-primary') || v.includes('--accent')) return colors.accent
  return null
}

function extractVarCall(css: string, start: number): { end: number; inner: string } | null {
  if (!css.startsWith('var(', start)) return null
  let depth = 1
  let j = start + 4
  while (j < css.length && depth > 0) {
    const ch = css[j]!
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    j += 1
  }
  if (depth !== 0) return null
  return { end: j, inner: css.slice(start + 4, j - 1) }
}

function bakeCssVarReferences(css: string, colors: ReturnType<typeof resolveMermaidCssColors>): string {
  let out = css
  for (let pass = 0; pass < 12; pass += 1) {
    let next = ''
    let i = 0
    let changed = false
    while (i < out.length) {
      const call = extractVarCall(out, i)
      if (call) {
        const resolved = resolveVarColor(`var(${call.inner})`, colors)
        if (resolved) {
          next += resolved
          changed = true
        } else {
          next += out.slice(i, call.end)
        }
        i = call.end
      } else {
        next += out[i]
        i += 1
      }
    }
    if (!changed) break
    out = next
  }
  return out
}

function bakeSvgEmbeddedStyles(svg: SVGSVGElement, colors: ReturnType<typeof resolveMermaidCssColors>): void {
  for (const styleEl of svg.querySelectorAll('style')) {
    const css = styleEl.textContent
    if (!css) continue
    styleEl.textContent = bakeCssVarReferences(css, colors)
  }
}

function isForeignObjectHtmlLabel(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  return (
    el.closest('foreignObject') != null &&
    (tag === 'div' || tag === 'span' || tag === 'p' || tag === 'foreignobject')
  )
}

function replaceAttrColor(
  el: Element,
  attr: 'fill' | 'stroke',
  colors: ReturnType<typeof resolveMermaidCssColors>,
): void {
  if (isForeignObjectHtmlLabel(el) && attr === 'fill') return

  const raw = el.getAttribute(attr)
  if (!raw || raw === 'none') return

  const resolvedVar = resolveVarColor(raw, colors)
  const value = resolvedVar ?? raw
  if (resolvedVar) el.setAttribute(attr, resolvedVar)

  if (attr === 'fill') {
    if (isTextElement(el)) {
      if (isWhite(value) || isBlack(value)) el.setAttribute(attr, colors.text)
      return
    }
    if (isMindmapNodeShape(el)) {
      if (isWhite(value) || isBlack(value)) el.setAttribute(attr, colors.elevated)
      return
    }
    if (isShapeElement(el)) {
      if (isWhite(value)) el.setAttribute(attr, colors.elevated)
      if (isBlack(value)) el.setAttribute(attr, colors.panel)
      return
    }
    if (isWhite(value)) el.setAttribute(attr, colors.elevated)
    if (isBlack(value)) el.setAttribute(attr, colors.panel)
    return
  }

  if (isBranchElement(el)) {
    if (isWhite(value) || isBlack(value) || isDefaultDarkStroke(value)) el.setAttribute(attr, colors.accent)
    return
  }
  if (isWhite(value) || isBlack(value) || isDefaultDarkStroke(value)) el.setAttribute(attr, colors.border)
}

function replaceInlineStyleColor(el: SVGElement, colors: ReturnType<typeof resolveMermaidCssColors>): void {
  if (el.style.fill) {
    const resolved = resolveVarColor(el.style.fill, colors)
    if (resolved) el.style.fill = resolved
    const fill = el.style.fill
    if (isTextElement(el)) {
      if (isWhite(fill) || isBlack(fill)) el.style.fill = colors.text
    } else if (isMindmapNodeShape(el)) {
      if (isWhite(fill) || isBlack(fill)) el.style.fill = colors.elevated
    } else if (isShapeElement(el)) {
      if (isWhite(fill)) el.style.fill = colors.elevated
      else if (isBlack(fill)) el.style.fill = colors.panel
    } else if (isWhite(fill)) {
      el.style.fill = colors.elevated
    } else if (isBlack(fill)) {
      el.style.fill = colors.panel
    }
  }

  if (el.style.stroke) {
    const resolved = resolveVarColor(el.style.stroke, colors)
    if (resolved) el.style.stroke = resolved
    const stroke = el.style.stroke
    if (isBranchElement(el)) {
      if (isWhite(stroke) || isBlack(stroke) || isDefaultDarkStroke(stroke)) {
        el.style.stroke = colors.accent
      }
    } else if (isWhite(stroke) || isBlack(stroke) || isDefaultDarkStroke(stroke)) {
      el.style.stroke = colors.border
    }
  }

  if (el.style.color) {
    const resolved = resolveVarColor(el.style.color, colors)
    if (resolved) el.style.color = resolved
    else if (isBlack(el.style.color) || isWhite(el.style.color)) el.style.color = colors.text
  }
}

/**
 * Post-rendering processing: Complete background nodes that cannot be covered by themeVariables in the real DOM of Mermaid/Mindmap.
 * Pass in `colors` (hex) when exporting PDF to avoid `var(--token)` in self-contained HTML that cannot be parsed.
 */
export function postProcessMermaidSvg(host: HTMLElement | null, colors?: MermaidResolvedColors): void {
  if (!host) return
  const c = resolveMermaidCssColors(colors)
  host.classList.add('mermaid')
  host.style.background = c.background
  host.style.backgroundColor = c.background
  const svg = host.querySelector('svg')
  if (!svg) return

  svg.classList.add('mermaid')
  svg.removeAttribute('style')
  svg.setAttribute(
    'style',
    [
      `background:${c.background}`,
      `background-color:${c.background}`,
      'max-width:100%',
      'height:auto',
    ].join(';'),
  )

  if (colors) bakeSvgEmbeddedStyles(svg, c)

  for (const el of svg.querySelectorAll('*')) {
    const svgEl = el as SVGElement
    replaceAttrColor(el, 'fill', c)
    replaceAttrColor(el, 'stroke', c)
    replaceInlineStyleColor(svgEl, c)
  }

  for (const el of svg.querySelectorAll('rect')) {
    const r = el as SVGRectElement
    const w = r.getAttribute('width')
    const h = r.getAttribute('height')
    const svgW = svg.getAttribute('width')
    const svgH = svg.getAttribute('height')
    if (w && h && svgW && svgH && String(w) === String(svgW) && String(h) === String(svgH)) {
      r.setAttribute('fill', c.background)
    }
  }

  for (const el of svg.querySelectorAll('.cluster rect, .mindmap-node rect, .mindmap-node circle, .mindmap-node polygon, .pm-mindmap-node rect, .pm-mindmap-node circle, .pm-mindmap-node polygon')) {
    const shape = el as SVGElement
    shape.setAttribute('fill', c.elevated)
    shape.setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('.node rect, .node polygon, .node circle, .labelBox')) {
    const shape = el as SVGElement
    shape.setAttribute('fill', c.panel)
    shape.setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('.actor, .actor-top, .actor-bottom')) {
    const shape = el as SVGElement
    shape.setAttribute('fill', c.panel)
    shape.setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('.actor-line, .messageLine0, .messageLine1, .flowchart-link')) {
    ;(el as SVGElement).setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('.messageText, .loopText, .noteText, .messageText0, .messageText1')) {
    ;(el as SVGElement).setAttribute('fill', c.text)
  }

  for (const el of svg.querySelectorAll('.note rect')) {
    const shape = el as SVGElement
    shape.setAttribute('fill', c.elevated)
    shape.setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('.edgePath path, .flowchart-link')) {
    ;(el as SVGElement).setAttribute('stroke', c.border)
  }

  for (const el of svg.querySelectorAll('text, tspan')) {
    const textEl = el as SVGElement
    textEl.setAttribute('fill', c.text)
    textEl.style.fill = c.text
  }

  for (const el of svg.querySelectorAll('.nodeLabel, .label, .edgeLabel')) {
    const label = el as SVGElement
    label.setAttribute('fill', c.text)
    label.style.fill = c.text
  }

  for (const el of svg.querySelectorAll('.mindmap-link, .pm-mindmap-link, .pm-mindmap-edges path')) {
    ;(el as SVGElement).setAttribute('stroke', c.accent)
  }

  for (const el of svg.querySelectorAll('.edgeLabel, .label, .nodeLabel')) {
    const label = el as HTMLElement
    label.style.background = 'transparent'
    label.style.backgroundColor = 'transparent'
    label.style.color = c.text
  }

  for (const fo of svg.querySelectorAll('foreignObject')) {
    const el = fo as SVGForeignObjectElement
    el.style.background = 'transparent'
    el.style.backgroundColor = 'transparent'
  }

  for (const el of svg.querySelectorAll('foreignObject div, foreignObject span, foreignObject p')) {
    const label = el as HTMLElement
    label.style.background = 'transparent'
    label.style.backgroundColor = 'transparent'
    label.style.color = c.text
    label.style.whiteSpace = 'nowrap'
    label.style.wordBreak = 'keep-all'
    label.style.lineHeight = '1.35'
    label.style.textAlign = 'center'
  }
}
