import MarkdownIt from 'markdown-it'
import markdownItDeflist from 'markdown-it-deflist'
import texmath from 'markdown-it-texmath'
import katex from 'katex'

import { LUNA_KATEX_HTML_OPTIONS } from './lunaKatexOptions'
import { registerLunaFootnoteMarkdownRules } from './lunaFootnoteMarkdown'
import { registerLunaLinkReferenceDefMarkdownRules } from './lunaLinkReferenceDefMarkdown'
import type { SemanticSliceKind } from './modeSwitchStructuralIRTypes'
import { type MdSemTok, mergeAdjacentMdTokens } from './modeSwitchSemanticZip'

export type MdItTokenLike = {
  readonly type: string
  readonly tag?: string
  readonly map?: [number, number] | null
  readonly nesting?: number
  readonly info?: string
  readonly content?: string
  readonly meta?: Record<string, unknown> | null
  readonly attrGet?: (name: string) => string | null
  readonly level?: number
  readonly markup?: string
  readonly children?: readonly MdItTokenLike[] | null
}

/** Shared markdown-it instance for mode-switch IR block scan and inline semantic fallback. */
export const modeSwitchIrMarkdownIt = createModeSwitchIrMarkdownIt()

function createModeSwitchIrMarkdownIt(): MarkdownIt {
  const md = MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
  })

  md.use(markdownItDeflist)
  md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: LUNA_KATEX_HTML_OPTIONS,
  })
  md.enable(['table', 'strikethrough'], true)
  registerLunaFootnoteMarkdownRules(md)
  registerLunaLinkReferenceDefMarkdownRules(md)
  md.block.ruler.before('paragraph', 'luna_toc_directive', (state, startLine, _endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (pos >= max) return false
    const line = state.src.slice(pos, max).replace(/\r$/u, '').trim()
    if (!/^\s*\[toc\]\s*$/iu.test(line)) return false
    if (silent) return true
    state.line = startLine + 1
    const token = state.push('toc_directive', '', 0)
    token.map = [startLine, state.line]
    token.markup = '[toc]'
    return true
  })
  md.block.ruler.before('fence', 'luna_raw_fence', (state, startLine, _endLine, silent) => {
    const line = state.src
      .slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
      .replace(/\r$/u, '')
    if (!/^\s*```\s*luna-raw\s*$/iu.test(line)) return false
    if (silent) return true

    let next = startLine + 1
    let rawSource = 'unknown'
    if (next < state.lineMax) {
      const l1 = state.src
        .slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
        .replace(/\r$/u, '')
      const sm = l1.match(/^\s*source:\s*(html|unknown|invalid)\s*$/iu)
      if (sm) {
        rawSource = sm[1]!.toLowerCase()
        next += 1
      }
    }

    const rawLines: string[] = []
    while (next < state.lineMax) {
      const bodyLine = state.src
        .slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
        .replace(/\r$/u, '')
      if (/^\s*```\s*$/u.test(bodyLine)) {
        next += 1
        break
      }
      rawLines.push(state.src.slice(state.bMarks[next], state.eMarks[next]).replace(/\r$/u, ''))
      next += 1
    }

    const token = state.push('luna_raw_block', '', 0)
    token.map = [startLine, next]
    token.attrSet('content', rawLines.join('\n'))
    token.attrSet('source', rawSource)
    state.line = next
    return true
  })

  return md
}

export function tokenAttr(token: MdItTokenLike, name: string): string | null {
  return typeof token.attrGet === 'function' ? token.attrGet(name) : null
}

const MARK_KIND_PRIORITY: readonly SemanticSliceKind[] = [
  'link',
  'strong',
  'em',
  'code',
  'strike',
  'sup',
  'sub',
  'html',
  'text',
]

function mdItTagToSemanticKind(tag: string): SemanticSliceKind | null {
  switch (tag) {
    case 'strong':
      return 'strong'
    case 'em':
      return 'em'
    case 's':
      return 'strike'
    case 'code':
      return 'code'
    case 'a':
      return 'link'
    case 'sup':
      return 'sup'
    case 'sub':
      return 'sub'
    default:
      return null
  }
}

/** Match `pmSliceKindFromMarks`: bold wins over italic when both apply. */
function resolveSemanticKindFromMarkStack(stack: readonly SemanticSliceKind[]): SemanticSliceKind {
  for (const kind of MARK_KIND_PRIORITY) {
    if (stack.includes(kind)) return kind
  }
  return 'text'
}

/**
 * Tokenize inline markdown with the same markdown-it instance used for IR block scans.
 * Used when the hand-rolled emphasis lexer disagrees with markdown-it / PM (e.g. `***a*a**`).
 */
export function tokenizeMarkdownInlineViaMdIt(
  bodySeg: string,
  baseAbs: number,
  inheritedPlainKind: SemanticSliceKind = 'text',
): MdSemTok[] | null {
  if (!bodySeg.length) return []

  let inlineRoot: MdItTokenLike | null
  try {
    const tokens = modeSwitchIrMarkdownIt.parseInline(bodySeg, {}) as MdItTokenLike[]
    inlineRoot = tokens.find((t) => t.type === 'inline') ?? null
  } catch {
    return null
  }
  if (!inlineRoot?.children?.length) return null

  const out: MdSemTok[] = []
  const stack: SemanticSliceKind[] = []
  let pos = 0

  const pushText = (text: string) => {
    if (!text.length) return
    const kind = stack.length > 0 ? resolveSemanticKindFromMarkStack(stack) : inheritedPlainKind
    out.push({
      text,
      kind,
      markdownFrom: baseAbs + pos,
      markdownTo: baseAbs + pos + text.length,
    })
    pos += text.length
  }

  const walk = (children: readonly MdItTokenLike[]) => {
    for (const token of children) {
      if (token.type === 'text') {
        pushText(token.content ?? '')
        continue
      }
      if (token.type === 'softbreak' || token.type === 'hardbreak') {
        pushText('\n')
        continue
      }
      if (token.type === 'code_inline') {
        const text = token.content ?? ''
        const fence = token.markup?.length ?? 1
        if (!text.length) {
          pos += fence * 2
          continue
        }
        out.push({
          text,
          kind: 'code',
          markdownFrom: baseAbs + pos + fence,
          markdownTo: baseAbs + pos + fence + text.length,
        })
        pos += fence * 2 + text.length
        continue
      }
      if (token.type.endsWith('_open')) {
        const markupLen = token.markup?.length ?? 0
        pos += markupLen
        const kind = mdItTagToSemanticKind(token.tag ?? '')
        if (kind) stack.push(kind)
        continue
      }
      if (token.type.endsWith('_close')) {
        const markupLen = token.markup?.length ?? 0
        pos += markupLen
        const kind = mdItTagToSemanticKind(token.tag ?? '')
        if (kind) {
          const top = stack.lastIndexOf(kind)
          if (top >= 0) stack.splice(top, 1)
        }
        continue
      }
      if (token.children?.length) {
        walk(token.children)
      }
    }
  }

  walk(inlineRoot.children)
  if (pos !== bodySeg.length) return null
  return mergeAdjacentMdTokens(out)
}
