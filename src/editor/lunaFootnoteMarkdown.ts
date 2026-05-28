import type MarkdownIt from 'markdown-it'

type InlineState = {
  pos: number
  src: string
  push: (type: string, tag: string, nesting: number) => { content: string; markup: string }
}

type BlockState = {
  blkIndent: number
  line: number
  getLines: (start: number, end: number, indent: number, keepLastLF: boolean) => string
  push: (type: string, tag: string, nesting: number) => { map?: number[]; meta?: Record<string, string>; content: string }
}

/** GFM footnote reference `[^label]`*/
function footnoteRefInline(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'luna_footnote_ref', (state, silent) => {
    const s = state as InlineState
    const start = s.pos
    if (s.src.charCodeAt(start) !== 0x5b /* [ */) return false
    const slice = s.src.slice(start)
    const m = /^\[\^([^\]\s][^\]]*)\]/.exec(slice)
    if (!m) return false
    if (silent) return true
    const label = m[1]!
    const token = s.push('footnote_ref', '', 0)
    token.content = label
    token.markup = m[0]
    s.pos += m[0].length
    return true
  })
}

/** GFM footnote definition `[^label]: content`*/
function footnoteDefBlock(md: MarkdownIt): void {
  md.block.ruler.before('reference', 'luna_footnote_def', (state, startLine, _endLine, silent) => {
    const s = state as BlockState
    const line = s.getLines(startLine, startLine + 1, s.blkIndent, false).trimEnd()
    const m = /^\[\^([^\]\s][^\]]*)\]:\s?(.*)$/.exec(line)
    if (!m) {
      const abutted = /^\[\^([^\]\s][^\]]*)\]([^\s].*)$/.exec(line)
      if (!abutted) return false
      if (silent) return true
      const label = abutted[1]!
      const content = abutted[2] ?? ''
      const token = s.push('footnote_def', '', 0)
      token.map = [startLine, startLine + 1]
      token.meta = { label, content }
      token.content = content
      s.line = startLine + 1
      return true
    }
    if (silent) return true
    const label = m[1]!
    const content = m[2] ?? ''
    const token = s.push('footnote_def', '', 0)
    token.map = [startLine, startLine + 1]
    token.meta = { label, content }
    token.content = content
    s.line = startLine + 1
    return true
  })
}

export function registerLunaFootnoteMarkdownRules(md: MarkdownIt): void {
  footnoteRefInline(md)
  footnoteDefBlock(md)
}
