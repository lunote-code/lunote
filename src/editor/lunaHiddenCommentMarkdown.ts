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

type BlockState = {
  bMarks: number[]
  eMarks: number[]
  tShift: number[]
  line: number
  lineMax: number
  src: string
  push: (type: string, tag: string, nesting: number) => {
    map?: number[]
    meta?: Record<string, string>
    content: string
  }
}

const HIDDEN_INLINE_RE = /^%%([\s\S]*?)%%/

function lineText(state: BlockState, line: number): string {
  const pos = state.bMarks[line]! + state.tShift[line]!
  const max = state.eMarks[line]!
  return state.src.slice(pos, max).replace(/\r$/u, '')
}

/** Inline `%% hidden %%` (single-line or same-paragraph). */
function hiddenCommentInline(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'luna_hidden_comment', (state, silent) => {
    const s = state as InlineState
    const slice = s.src.slice(s.pos)
    const m = HIDDEN_INLINE_RE.exec(slice)
    if (!m) return false
    if (silent) return true
    const body = m[1] ?? ''
    const token = s.push('hidden_comment', '', 0)
    token.content = body
    token.markup = m[0]
    token.meta = { body, raw: m[0] }
    s.pos += m[0].length
    return true
  })
}

/**
 * Block-level Obsidian comment:
 * %%
 * hidden body
 * %%
 */
function hiddenCommentBlock(md: MarkdownIt): void {
  md.block.ruler.before('paragraph', 'luna_hidden_comment_block', (state, startLine, endLine, silent) => {
    const s = state as BlockState
    const open = lineText(s, startLine).trim()
    if (open !== '%%') return false

    let closeLine = -1
    const bodyLines: string[] = []
    for (let line = startLine + 1; line < endLine; line += 1) {
      const text = lineText(s, line)
      if (text.trim() === '%%') {
        closeLine = line
        break
      }
      bodyLines.push(text)
    }
    if (closeLine < 0) return false
    if (silent) return true

    const body = bodyLines.join('\n')
    const token = s.push('hidden_comment_block', '', 0)
    token.map = [startLine, closeLine + 1]
    token.meta = { body, raw: `%%\n${body}\n%%` }
    token.content = body
    s.line = closeLine + 1
    return true
  })
}

export function registerLunaHiddenCommentMarkdownRules(md: MarkdownIt): void {
  hiddenCommentBlock(md)
  hiddenCommentInline(md)
}
