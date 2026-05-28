import { buildHeadingOutlineTree, type HeadingOutlineTreeNode } from '../editor/outlineHeadingTree'
import type { PmTocHeading } from '../editor/pmHeadingNav'
import { getLocaleMessagesSnapshot, type UiLocaleId } from '../i18n'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Export-only TOC: plain nested lists (no editor `document-outline-*` classes). */
function renderExportTocList(nodes: HeadingOutlineTreeNode[]): string {
  if (nodes.length === 0) return ''
  const items = nodes
    .map((node) => {
      const childList =
        node.children.length > 0
          ? `<ul class="md-export-toc-list">${renderExportTocList(node.children)}</ul>`
          : ''
      return `<li class="md-export-toc-item" data-toc-level="${node.level}"><a class="md-export-toc-link" href="#${escapeHtml(node.id)}">${escapeHtml(node.title)}</a>${childList}</li>`
    })
    .join('')
  return items
}

export function resolveExportTocTitle(localeId?: UiLocaleId): string {
  const locale = localeId ?? 'en'
  const messages = getLocaleMessagesSnapshot(locale)
  return messages['menu.para.toc'] || messages['app.sidebar.outlineHeader'] || 'Contents'
}

export function buildExportTocNavHtml(headings: PmTocHeading[], localeId?: UiLocaleId): string {
  const tree = buildHeadingOutlineTree(headings)
  if (tree.length === 0) return ''
  const title = escapeHtml(resolveExportTocTitle(localeId))
  const list = renderExportTocList(tree)
  return `<nav class="md-export-toc" aria-label="${title}"><div class="md-export-toc-inner"><div class="md-export-toc-title">${title}</div><ul class="md-export-toc-list md-export-toc-list--root">${list}</ul></div></nav>`
}
