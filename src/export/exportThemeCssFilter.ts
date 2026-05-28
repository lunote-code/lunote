const BLOCKED_SELECTOR_TOKENS = [
  '.workspace',
  '.sidebar',
  '.workspace-split',
  '.workspace-ribbon',
  '.workspace-tabs',
  '.workspace-tab-',
  '.nav-files-container',
  '.nav-folder',
  '.nav-file',
  '.titlebar',
  '.status-bar',
  '.search-result',
  '.search-input-container',
  '.clickable-icon',
  '.tree-item',
  /* Obsidian themes often ship sidebar outline rules under these selectors; they break export TOC layout. */
  '.document-outline',
  '.inline-doc-toc',
]

const ALLOWED_SELECTOR_TOKENS = [
  ':root',
  'html',
  'body',
  'article',
  'main',
  '.markdown-export-root',
  '.markdown-body',
  '.markdown-export-body',
  '.markdown-preview-view',
  '.markdown-reading-view',
  '.markdown-source-view',
  '.view-content',
  '.cm-editor',
  '.cm-scroller',
  '.cm-gutters',
  '.cm-content',
  '.cm-line',
  '.callout',
  '.md-callout',
  '.markdown-table-wrap',
  '.mermaid',
  '.katex',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'img',
  'svg',
  'a',
]

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function shouldKeepSelector(selector: string): boolean {
  const normalized = selector.replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  if (BLOCKED_SELECTOR_TOKENS.some((token) => normalized.includes(token))) return false
  return ALLOWED_SELECTOR_TOKENS.some((token) => normalized.includes(token))
}

function filterCssBlock(css: string): string {
  let out = ''
  let cursor = 0
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor)
    if (open === -1) break
    const selector = css.slice(cursor, open).trim()
    let depth = 1
    let close = open + 1
    while (close < css.length && depth > 0) {
      const ch = css[close]
      if (ch === '{') depth += 1
      if (ch === '}') depth -= 1
      close += 1
    }
    const body = css.slice(open + 1, close - 1)
    if (selector.startsWith('@media') || selector.startsWith('@supports') || selector.startsWith('@layer')) {
      const filteredInner = filterCssBlock(body)
      if (filteredInner.trim()) out += `${selector}{${filteredInner}}\n`
    } else if (
      selector.startsWith('@font-face') ||
      selector.startsWith('@keyframes') ||
      selector.startsWith('@page')
    ) {
      out += `${selector}{${body}}\n`
    } else {
      const selectors = selector.split(',').map((item) => item.trim()).filter(Boolean)
      const kept = selectors.filter(shouldKeepSelector)
      if (kept.length > 0) out += `${kept.join(', ')}{${body}}\n`
    }
    cursor = close
  }
  return out
}

export function filterThemeCssForExport(css: string): string {
  const trimmed = stripCssComments(css).trim()
  if (!trimmed) return ''
  return filterCssBlock(trimmed)
}

export function normalizeRawExportCss(css: string): string {
  return stripCssComments(css).trim()
}
