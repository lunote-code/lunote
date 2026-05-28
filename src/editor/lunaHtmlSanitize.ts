import DOMPurify from 'dompurify'
import type { Config as DomPurifyConfig } from 'dompurify'

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
