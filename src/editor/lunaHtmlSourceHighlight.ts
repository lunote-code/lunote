import highlight from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'

let registered = false

function ensureHtmlHighlightLanguage(): void {
  if (registered) return
  highlight.registerLanguage('xml', xml)
  registered = true
}

/** Highlight embedded HTML source for the rawBlock in-place editor overlay. */
export function highlightHtmlSource(source: string): string {
  ensureHtmlHighlightLanguage()
  const text = source.length > 0 ? source : ' '
  try {
    return highlight.highlight(text, { language: 'xml', ignoreIllegals: true }).value
  } catch {
    return highlight.highlightAuto(text, ['xml']).value
  }
}
