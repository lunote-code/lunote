import { parseDrawingFenceBody, renderDrawingToCanvas } from './drawing/drawingDocument'

function isDrawingCodeElement(code: Element): boolean {
  const className = code.className
  if (typeof className === 'string' && /(?:^|\s)language-drawing(?:\s|$)/.test(className)) {
    return true
  }
  if (code.getAttribute('data-language') === 'drawing') return true
  const parent = code.parentElement
  return parent?.tagName === 'PRE' && parent.getAttribute('data-language') === 'drawing'
}

function looksLikeDrawingFenceBody(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    return typeof parsed.w === 'number' && typeof parsed.h === 'number' && Array.isArray(parsed.strokes)
  } catch {
    return false
  }
}

/** Replace exported ```drawing fences in embed HTML with read-only canvas previews. */
export function hydrateDrawingPreviewsInContainer(root: HTMLElement): void {
  const codes = Array.from(root.querySelectorAll('pre code'))
  for (const code of codes) {
    if (!isDrawingCodeElement(code) && !looksLikeDrawingFenceBody(code.textContent ?? '')) continue
    const pre = code.closest('pre')
    if (!pre) continue

    const doc = parseDrawingFenceBody(code.textContent ?? '')
    const wrap = document.createElement('div')
    wrap.className = 'pm-drawing-preview-wrap'
    wrap.setAttribute('data-pm-drawing-preview', '1')

    const stage = document.createElement('div')
    stage.className = 'pm-drawing-preview-stage'

    const canvas = document.createElement('canvas')
    canvas.className = 'pm-drawing-preview-canvas'
    canvas.width = doc.w
    canvas.height = doc.h
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Drawing')

    const ctx = canvas.getContext('2d')
    if (ctx) renderDrawingToCanvas(ctx, doc)

    stage.appendChild(canvas)
    wrap.appendChild(stage)
    pre.replaceWith(wrap)
  }
}
