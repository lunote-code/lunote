import type MarkdownIt from 'markdown-it'

import { parseWikiEmbedTokenAt } from './wikiEmbedParse'

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

function lineText(state: BlockState, line: number): string {
  const pos = state.bMarks[line]! + state.tShift[line]!
  const max = state.eMarks[line]!
  return state.src.slice(pos, max).replace(/\r$/u, '')
}

function pushWikiEmbedToken(
  state: InlineState,
  parsed: ReturnType<typeof parseWikiEmbedTokenAt>,
): void {
  if (!parsed) return
  const token = state.push('wiki_embed', '', 0)
  token.content = parsed.raw
  token.markup = parsed.raw
  token.meta = {
    docKey: parsed.docKey,
    heading: parsed.heading ?? '',
    blockId: parsed.blockId ?? '',
    alias: parsed.alias ?? '',
    raw: parsed.raw,
  }
}

/** `![[note]]` inline embed token (paragraph-local). */
function wikiEmbedInline(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'luna_wiki_embed', (state, silent) => {
    const s = state as InlineState
    const parsed = parseWikiEmbedTokenAt(s.src, s.pos)
    if (!parsed) return false
    if (silent) return true
    pushWikiEmbedToken(s, parsed)
    s.pos += parsed.length
    return true
  })
}

/** Standalone `![[note]]` line → block-level embed token. */
function wikiEmbedBlock(md: MarkdownIt): void {
  md.block.ruler.before('paragraph', 'luna_wiki_embed_block', (state, startLine, _endLine, silent) => {
    const s = state as BlockState
    const line = lineText(s, startLine).trim()
    const parsed = parseWikiEmbedTokenAt(line, 0)
    if (!parsed || parsed.raw !== line) return false
    if (silent) return true
    const token = s.push('wiki_embed_block', '', 0)
    token.map = [startLine, startLine + 1]
    token.meta = {
      docKey: parsed.docKey,
      heading: parsed.heading ?? '',
      blockId: parsed.blockId ?? '',
      alias: parsed.alias ?? '',
      raw: parsed.raw,
    }
    token.content = parsed.raw
    s.line = startLine + 1
    return true
  })
}

export function registerLunaWikiEmbedMarkdownRules(md: MarkdownIt): void {
  wikiEmbedBlock(md)
  wikiEmbedInline(md)
}
