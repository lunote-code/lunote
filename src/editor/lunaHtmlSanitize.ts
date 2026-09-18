import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'

import {
  buildEmbeddedHtmlCacheKey,
  embeddedHtmlHasResolvableMedia,
  readEmbeddedHtmlCache,
  writeEmbeddedHtmlCache,
} from './lunaEmbeddedHtmlCache'

const FORBID_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'applet',
  'svg',
] as const

const FORBID_ATTR = [
  'onerror',
  'onload',
  'onclick',
  'onmouseover',
  'onfocus',
  'onblur',
  'onchange',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'formaction',
  'xlink:href',
] as const

/** WYSIWYG inline HTML: shared with rawInline/rawBlock NodeView*/
export const LUNA_EMBEDDED_HTML_PURIFY: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [...FORBID_TAGS],
  FORBID_ATTR: [...FORBID_ATTR],
  ALLOW_DATA_ATTR: false,
}

export function sanitizeEmbeddedHtml(html: string): string {
  return DOMPurify.sanitize(html, LUNA_EMBEDDED_HTML_PURIFY) as string
}

const EMBEDDED_MEDIA_SRC_SELECTOR = 'img[src], video[src], source[src]'

export type RenderEmbeddedHtmlOptions = {
  resolveMediaSrc?: (src: string) => string
  /** Scope for render cache (e.g. workspace root + active note path). */
  mediaRenderScope?: string
}

function rewriteEmbeddedMediaSrc(
  safeHtml: string,
  resolveMediaSrc: (src: string) => string,
): string {
  if (!embeddedHtmlHasResolvableMedia(safeHtml) || typeof document === 'undefined') return safeHtml

  const doc = new DOMParser().parseFromString(`<div id="luna-html-wrap">${safeHtml}</div>`, 'text/html')
  const wrap = doc.getElementById('luna-html-wrap')
  if (!wrap) return safeHtml

  wrap.querySelectorAll(EMBEDDED_MEDIA_SRC_SELECTOR).forEach((node) => {
    const el = node as HTMLImageElement | HTMLVideoElement | HTMLSourceElement
    const src = el.getAttribute('src')
    if (!src?.trim()) return
    const resolved = resolveMediaSrc(src)
    if (!resolved || resolved === src) return
    el.setAttribute('data-luna-original-src', src)
    el.setAttribute('src', resolved)
  })

  return wrap.innerHTML
}

function renderEmbeddedHtmlUncached(html: string, options: RenderEmbeddedHtmlOptions): string {
  const safe = sanitizeEmbeddedHtml(html)
  const { resolveMediaSrc } = options
  if (!resolveMediaSrc) return safe
  return rewriteEmbeddedMediaSrc(safe, resolveMediaSrc)
}

/** Sanitize markdown-embedded HTML and rewrite relative media `src` for the WYSIWYG surface. */
export function renderEmbeddedHtml(html: string, options: RenderEmbeddedHtmlOptions = {}): string {
  const scope = options.mediaRenderScope?.trim() ?? ''
  const cacheKey = buildEmbeddedHtmlCacheKey(scope, html)
  if (cacheKey) {
    const cached = readEmbeddedHtmlCache(cacheKey)
    if (cached != null) return cached
  }

  const rendered = renderEmbeddedHtmlUncached(html, options)
  if (cacheKey) writeEmbeddedHtmlCache(cacheKey, rendered)
  return rendered
}
