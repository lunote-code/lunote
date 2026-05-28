import type MarkdownIt from 'markdown-it'

type BlockState = {
  blkIndent: number
  line: number
  getLines: (start: number, end: number, indent: number, keepLastLF: boolean) => string
  push: (type: string, tag: string, nesting: number) => { map?: number[]; meta?: Record<string, string>; content: string }
}

/** Markdown link reference definition `[label]: url` (not footnote `[^label]:`)*/
function linkReferenceDefBlock(md: MarkdownIt): void {
  md.block.ruler.before('luna_footnote_def', 'luna_link_reference_def', (state, startLine, _endLine, silent) => {
    const s = state as BlockState
    const line = s.getLines(startLine, startLine + 1, s.blkIndent, false).trimEnd()
    const m = /^\[([^\]^]*)\]:\s*(\S+)(?:\s+"([^"]*)")?\s*$/.exec(line)
    if (!m) return false
    if (silent) return true
    const label = m[1]!
    const href = m[2]!
    const title = m[3] ?? ''
    const token = s.push('link_reference_def', '', 0)
    token.map = [startLine, startLine + 1]
    token.meta = { label, href, title }
    token.content = href
    s.line = startLine + 1
    return true
  })
}

export function registerLunaLinkReferenceDefMarkdownRules(md: MarkdownIt): void {
  linkReferenceDefBlock(md)
}
