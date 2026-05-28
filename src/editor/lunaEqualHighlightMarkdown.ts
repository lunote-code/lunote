import type MarkdownIt from 'markdown-it'

const EQ = 0x3d

/** Register `==highlight==` inline rule (aligned with remarkEqualHighlight / export HTML)*/
export function registerLunaEqualHighlightMarkdownRules(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'luna_equal_highlight', (state, silent) => {
    const start = state.pos
    if (start + 1 >= state.posMax) return false
    if (state.src.charCodeAt(start) !== EQ || state.src.charCodeAt(start + 1) !== EQ) return false
    if (start > 0 && state.src.charCodeAt(start - 1) === EQ) return false

    let pos = start + 2
    while (pos + 1 < state.posMax) {
      if (state.src.charCodeAt(pos) === EQ && state.src.charCodeAt(pos + 1) === EQ) {
        if (silent) return true
        const content = state.src.slice(start + 2, pos)
        if (!content || content.includes('\n')) return false
        const tokenOpen = state.push('luna_equal_highlight_open', '', 1)
        tokenOpen.markup = '=='
        const textToken = state.push('text', '', 0)
        textToken.content = content
        const tokenClose = state.push('luna_equal_highlight_close', '', -1)
        tokenClose.markup = '=='
        state.pos = pos + 2
        return true
      }
      pos += 1
    }
    return false
  })
}
