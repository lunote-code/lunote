import type MarkdownIt from 'markdown-it'

type InlineState = {
  pos: number
  src: string
  push: (type: string, tag: string, nesting: number) => {
    content: string
    markup: string
    meta?: Record<string, string>
  }
}

const INLINE_TAG_RE = /^#([a-zA-Z][a-zA-Z0-9_/-]*)/

/** Obsidian-style inline tag `#project/sub`. */
function inlineTagRule(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'luna_inline_tag', (state, silent) => {
    const s = state as InlineState
    if (s.pos > 0) {
      const prev = s.src.charCodeAt(s.pos - 1)
      if (prev !== 0x20 && prev !== 0x09 && prev !== 0x0a && prev !== 0x0d && prev !== 0xa0) {
        return false
      }
    }
    const slice = s.src.slice(s.pos)
    const m = INLINE_TAG_RE.exec(slice)
    if (!m) return false
    if (silent) return true
    const tag = m[1]!
    const token = s.push('inline_tag', '', 0)
    token.content = tag
    token.markup = `#${tag}`
    token.meta = { tag, raw: `#${tag}` }
    s.pos += m[0].length
    return true
  })
}

export function registerLunaInlineTagMarkdownRules(md: MarkdownIt): void {
  inlineTagRule(md)
}
