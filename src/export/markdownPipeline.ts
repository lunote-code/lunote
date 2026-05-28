import DOMPurify from 'dompurify'
import type { UiLocaleId } from '../i18n/resolveLocale'
import type { ExportTocMode } from './exportPreset'

import { rehypeWrapMarkdownTables } from './rehypeWrapMarkdownTables'
import { injectMermaidExportDiagrams } from './rehypeInjectMermaidSvgs'
import { buildExportTocNavHtml, resolveExportTocTitle } from './exportTocHtml'
import { createUnifiedExportProcessor, normalizeMarkdownForExport } from '../markdown/unifiedExportProcessor'

/** Export HTML whitelist: retain GFM table structure and cell `align` (`:---` / `:---:` / `---:` alignment output is align attribute)*/
const exportPurify = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption'],
    ADD_ATTR: ['class', 'id', 'colspan', 'rowspan', 'align', 'style', 'data-language', 'data-luna-callout', 'aria-hidden'],
  })

function normalizeTocMarkerText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isLegacyTocLinkOnlyBlock(el: Element): boolean {
  const tag = el.tagName
  if (tag === 'P' || tag === 'DIV') {
    const anchors = Array.from(el.querySelectorAll('a[href^="#"]'))
    if (anchors.length === 0) return false
    const text = normalizeTocMarkerText(el.textContent || '')
    const anchorText = normalizeTocMarkerText(anchors.map((a) => a.textContent?.trim() || '').join(' '))
    return Boolean(anchorText) && text === anchorText
  }
  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(el.children).filter((child) => child.tagName === 'LI')
    if (items.length === 0) return false
    return items.every((item) => {
      const anchors = Array.from(item.querySelectorAll('a[href^="#"]'))
      if (anchors.length === 0) return false
      const text = normalizeTocMarkerText(item.textContent || '')
      const anchorText = normalizeTocMarkerText(anchors.map((a) => a.textContent?.trim() || '').join(' '))
      return Boolean(anchorText) && text === anchorText
    })
  }
  return false
}

function injectExportToc(html: string, localeId?: UiLocaleId, tocMode: ExportTocMode = 'marker-only'): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const headings = Array.from(template.content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'))
  const localizedTitle = normalizeTocMarkerText(resolveExportTocTitle(localeId))
  const tocMarkers = new Set(['[toc]', 'toc', 'contents', 'table of contents', localizedTitle])
  const topLevelBlocks = Array.from(template.content.children)
  const tocTargets = topLevelBlocks.filter((el) => {
    if (el.tagName !== 'P' && el.tagName !== 'DIV') return false
    return tocMarkers.has(normalizeTocMarkerText(el.textContent || ''))
  })

  if (tocMode === 'off') {
    for (const target of tocTargets) target.remove()
    return template.innerHTML
  }

  if (tocTargets.length === 0 && tocMode !== 'always') return html

  const tocHeadings = headings.map((heading) => ({
    id: heading.id,
    title: heading.textContent?.trim() || heading.id,
    level: Number(heading.tagName.slice(1)) || 1,
  }))

  if (tocMode === 'always' && tocTargets.length === 0) {
    if (tocHeadings.length === 0) return template.innerHTML
    const wrapper = document.createElement('template')
    wrapper.innerHTML = buildExportTocNavHtml(tocHeadings, localeId)
    const nav = wrapper.content.firstElementChild
    if (nav) template.content.prepend(nav)
    return template.innerHTML
  }

  for (const target of tocTargets) {
    if (tocHeadings.length === 0) {
      target.remove()
      continue
    }
    let sibling = target.nextElementSibling
    while (sibling && isLegacyTocLinkOnlyBlock(sibling)) {
      const current = sibling
      sibling = sibling.nextElementSibling
      current.remove()
    }
    const navHtml = buildExportTocNavHtml(tocHeadings, localeId)
    const wrapper = document.createElement('template')
    wrapper.innerHTML = navHtml
    const nav = wrapper.content.firstElementChild
    if (nav) target.replaceWith(nav)
  }
  return template.innerHTML
}

/**
 * Markdown → HTML snippets (**GFM**: tables, strikethroughs, task lists, etc.; math, callout, `==highlight==`, etc.).
 * Soft breaks are consistent with edit-side markdown-it (`breaks: false`), without using remark-breaks.
 * Shared by HTML / PDF / Word, ensuring the same source of export (see `unifiedExportProcessor`).
 */
export async function markdownToHtmlFragment(
  md: string,
  opts?: { dark?: boolean; localeId?: UiLocaleId; tocMode?: ExportTocMode },
): Promise<string> {
  const normalized = normalizeMarkdownForExport(md)
  const file = await createUnifiedExportProcessor().use(rehypeWrapMarkdownTables).process(normalized)
  const purified = exportPurify(String(file))
  const withToc = injectExportToc(purified, opts?.localeId, opts?.tocMode)
  return injectMermaidExportDiagrams(withToc, normalized, { dark: opts?.dark })
}
