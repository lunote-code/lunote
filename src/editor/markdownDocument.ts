import GithubSlugger from 'github-slugger'
import MarkdownIt from 'markdown-it'
import markdownItDeflist from 'markdown-it-deflist'
import markdownItEmoji from 'markdown-it-emoji/lib/full.mjs'
import type Token from 'markdown-it/lib/token.mjs'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import { LUNA_KATEX_HTML_OPTIONS } from './lunaKatexOptions'
import {
  MarkdownParser,
  MarkdownSerializer,
  type MarkdownSerializerState,
  type ParseSpec,
} from 'prosemirror-markdown'
import { Fragment } from 'prosemirror-model'
import type { Mark, Node as ProseMirrorNode, Schema, Attrs, NodeType } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'
import { TableMap } from '@tiptap/pm/tables'
import { calloutFirstLineForKind, matchCalloutFirstLine, parseCalloutLeadingParagraph, CALLOUT_BRACKET_TAGS } from './lunaCallout'
import type { CalloutKind } from './lunaCallout'
import {
  preprocessLunaMarkdownAdmonitionsWithLineMap,
  preprocessMarkdownForEditParse,
} from './lunaMarkdownExtensionsPreprocess'
import { liftPlainTextFootnoteRefs } from './lunaFootnoteTextLift'
import { liftFootnoteDefParagraphs } from './lunaFootnoteDefLift'
import { registerLunaFootnoteMarkdownRules } from './lunaFootnoteMarkdown'
import { formatLinkReferenceDefLine } from './lunaLinkReferenceDef'
import { registerLunaLinkReferenceDefMarkdownRules } from './lunaLinkReferenceDefMarkdown'
import { registerLunaEqualHighlightMarkdownRules } from './lunaEqualHighlightMarkdown'
import { isLunaAssetHref } from '../assets/markdownLinkTransformer'
import { normalizeLunaRawSource, type LunaRawSource } from './lunaRawBlock'
import { parseCellTextAlign, type LunaCellTextAlign } from './lunaTableCellAlign'
import { validateASTBeforeCommit } from './astGuardrails'
import { liftInlineHtmlFormattingMarksIterated } from './lunaInlineHtmlMarkLift'
import { newMermaidBlockId } from './extensions/MermaidNode'
import {
  alignSerializedTrailingBlankLines,
  countTrailingEmptyParagraphs,
  liftBlankLineParagraphs,
} from './liftBlankLineParagraphs'
import type {
  ProductionMarkdown,
  RenderMode,
  SerializeDocToMarkdownResult,
} from './compiler/markdownCompilerTypes'
import {
  buildLiftStandaloneTocDirectiveTransform,
  liftMarkdownTaskLists,
} from './markdownStructuralTransforms'
import { normalizeTextColor } from './lunaTextColor'
import { formatCodeFenceInfo, parseCodeFenceInfo } from './codeBlock/markdownFenceAttrs'
import { normalizeCodeBlockTrailingEmptyLinesInDoc } from './codeBlock/behavior/trailingEmptyLines'

/**
 * markdown-it GFM table: second row `| :--- | :---: | ---: |` is parsed as a column-aligned array and written to each
 * `style="text-align:..."` of `th_open` / `td_open` will not generate a separate "aligned line" token.
 * If ParseSpec does not have `getAttrs`, prosemirror-markdown will open the node with empty attrs, which is equivalent to ignoring the entire line alignment semantics.
 */
function gfmStyleTextAlignFromMdItToken(tok: Token): LunaCellTextAlign | null {
  let style = tok.attrGet('style') ?? ''
  if (!style && Array.isArray(tok.attrs)) {
    for (const pair of tok.attrs) {
      if (pair[0] === 'style') {
        style = String(pair[1] ?? '')
        break
      }
    }
  }
  const m = /text-align\s*:\s*(left|center|right)/iu.exec(style.trim())
  if (!m) return null
  return m[1].toLowerCase() as LunaCellTextAlign
}

function gfmCellAlignAttrsFromMdItToken(tok: Token): Record<string, unknown> {
  const align = gfmStyleTextAlignFromMdItToken(tok)
  if (!align) return {}
  /** Write `align` (TipTap built-in) and `lunaCellTextAlign` (Luna serialization/column toolbar) at the same time; `mergeAttributes` will merge duplicate text-align.*/
  return { align, lunaCellTextAlign: align }
}

/** Consistent with `tocDirective` / markdown-it `luna_toc_directive`: the entire paragraph is only `[toc]` (case insensitive, can contain leading and trailing whitespace within the line)*/
const LUNA_STANDALONE_TOC_LINE = /^\s*\[toc\]\s*$/iu

type LunaMarkdownSerializerState = MarkdownSerializerState & {
  out: string
  /** `paragraph` is written from this file during serialization, for `text` to determine whether it is the top-level `[toc]` placeholder*/
  lunaSerParagraphParent?: ProseMirrorNode
  inAutolink?: boolean
  lunaRawTextDepth?: number
}

function assertSerializerNodeCoverage(serializer: MarkdownSerializer, doc: ProseMirrorNode): void {
  const handlers = (serializer as unknown as { nodes?: Record<string, unknown> }).nodes ?? {}
  doc.descendants((node) => {
    if (node.type.name === 'doc' || node.type.name === 'text') return
    if (!Object.prototype.hasOwnProperty.call(handlers, node.type.name)) {
      throw new Error(`Unknown AST node for markdown serializer: ${node.type.name}`)
    }
  })
}

function withRawTextSerializerScope<T>(state: MarkdownSerializerState, fn: () => T): T {
  const st = state as LunaMarkdownSerializerState
  st.lunaRawTextDepth = (st.lunaRawTextDepth ?? 0) + 1
  try {
    return fn()
  } finally {
    st.lunaRawTextDepth = Math.max(0, (st.lunaRawTextDepth ?? 1) - 1)
  }
}

const WIKI_LINK_SERIALIZE_RE =
  /(!)?\[\[([^\]|#^]+?)(?:#([^\]|^]+?))?(?:\^([^\]]+?))?(?:\|([^\]]+?))?\]\]/gu

/** Escape plain text for markdown while preserving Obsidian wiki block-ref carets (`[[note^block]]`).*/
function escapeLunaPlainText(text: string): string {
  const protectedCarets = new Set<number>()
  WIKI_LINK_SERIALIZE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKI_LINK_SERIALIZE_RE.exec(text)) !== null) {
    if (m[4] === undefined) continue
    const caretIdx = m[0].indexOf('^')
    if (caretIdx >= 0) protectedCarets.add(m.index + caretIdx)
  }
  let str = text.replace(
    /[`*\\~\][[_]/g,
    (ch, i) =>
      ch === '_' &&
      i > 0 &&
      i + 1 < text.length &&
      /\w/u.test(text[i - 1]!) &&
      /\w/u.test(text[i + 1]!)
        ? ch
        : `\\${ch}`,
  )
  str = str.replace(/\^/g, (ch, i) => (protectedCarets.has(i) ? ch : `\\${ch}`))
  return str
}

function gfmTableSeparatorForAlign(align: LunaCellTextAlign | null): string {
  if (align === 'left') return ':---'
  if (align === 'center') return ':---:'
  if (align === 'right') return '---:'
  return '---'
}

/** Deduces GFM delimited rows from the `lunaCellTextAlign` of any cell in this column (taking the first explicit value from top to bottom)*/
function columnLunaTextAlignForGfm(table: ProseMirrorNode, colIndex: number, map: TableMap): LunaCellTextAlign | null {
  for (let r = 0; r < map.height; r += 1) {
    const rel = map.positionAt(r, colIndex, table)
    const cell = table.nodeAt(rel)
    if (!cell) continue
    const attrs = cell.attrs as { lunaCellTextAlign?: unknown; align?: unknown }
    const a = parseCellTextAlign(attrs.lunaCellTextAlign) ?? parseCellTextAlign(attrs.align)
    if (a) return a
  }
  return null
}

/**
 * ## Documentation kernel (aligned Typora-style targets)
 *
 * **Structured truth (when WYSIWYG is turned on)** ProseMirror / TipTap's `doc` is a semantic tree; the editing command only changes `doc`.
 *
 * **Persistence and Source Mode** The same note is `markdown: string` on disk and in CodeMirror. When switching modes:
 * Source code → WYSIWYG: `parseMarkdownToDoc`; WYSIWYG → Source code: `serializeDocToMarkdown` (via `getMarkdown`, etc.).
 * Do not allow the React render layer or the DOM to become the "main" data source.
 *
 * **Parsing** Markdown-it is only used as a thin adaptation layer for **token → PM node**, and does not perform `<img>` regular rewriting or Unicode emoji and shortcode conversion in this pipeline.
 * The allowed parse preprocessing and export stack share `preprocessMarkdownForEditParse` / `normalizeMarkdownPipeline` (admonition, frontmatter stripping).
 * `html_*` → `rawBlock`/`rawInline`; `emoji` token → `emoji` node; the entire parsing throws an error → `rawBlock` (`invalid`).
 * If post-processing such as Callout/task list fails, this step will be skipped and the successfully parsed `doc` will be retained.
 *
 * **Serialization** The caller must not overwrite the external buffer when **serialization** fails; the `text` node is output as the original text, and emoji shortcode rewriting is not performed at this layer.
 *
 * **HTML token** markdown-it uses `html: true` to produce `html_*` token; `html_block` / `html_inline` is rendered as HTML by the `rawBlock`/`rawInline` NodeView after DOMPurify in WYSIWYG (non-code block); `source` non-`html` raw is still plain text `pre`/inline text.
 */
const markdownIt = MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
})

//By default, markdown-it normalizeLink will do mdurl.encode on the path and encode Chinese characters into %xx.
//Inconsistent with the local disk path and Tauri convertFileSrc (editors such as Typora retain the original text).
//The original string after trimming is retained for relative paths without protocols; URLs with protocols still follow the default logic (including host name punycode, etc.).
{
  const mdUrlNormalize = markdownIt.normalizeLink.bind(markdownIt)
  markdownIt.normalizeLink = (url: string) => {
    const t = String(url).trim()
    if (t && !/^[a-z][a-z0-9+.-]*:/iu.test(t) && !t.startsWith('//')) return t
    return mdUrlNormalize(t)
  }
}

markdownIt.use(markdownItSup).use(markdownItSub).use(markdownItDeflist)
markdownIt.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: LUNA_KATEX_HTML_OPTIONS,
})
markdownIt.use(markdownItEmoji)

/**
 * GFM pipeline table: `markdown-it` 13+ has built-in rules such as `table` / `strikethrough` (~~) in the default preset.
 * No need to install the separate `markdown-it-gfm` npm package. Explicit `enable` here to avoid using `zero`/`commonmark` in the future
 * The table is closed silently during preset.
 */
markdownIt.enable(['table', 'strikethrough'], true)

const LUNA_FOOTNOTE_RULER = Symbol('lunaFootnoteRuler')
type MarkdownItWithFootnote = MarkdownIt & { [LUNA_FOOTNOTE_RULER]?: true }
const mdWithFootnote = markdownIt as MarkdownItWithFootnote
if (!mdWithFootnote[LUNA_FOOTNOTE_RULER]) {
  mdWithFootnote[LUNA_FOOTNOTE_RULER] = true
  registerLunaFootnoteMarkdownRules(markdownIt)
}

const LUNA_LINK_REFERENCE_DEF_RULER = Symbol('lunaLinkReferenceDefRuler')
type MarkdownItWithLinkReferenceDef = MarkdownIt & { [LUNA_LINK_REFERENCE_DEF_RULER]?: true }
const mdWithLinkReferenceDef = markdownIt as MarkdownItWithLinkReferenceDef
if (!mdWithLinkReferenceDef[LUNA_LINK_REFERENCE_DEF_RULER]) {
  mdWithLinkReferenceDef[LUNA_LINK_REFERENCE_DEF_RULER] = true
  registerLunaLinkReferenceDefMarkdownRules(markdownIt)
}

const LUNA_EQUAL_HIGHLIGHT_RULER = Symbol('lunaEqualHighlightRuler')
type MarkdownItWithEqualHighlight = MarkdownIt & { [LUNA_EQUAL_HIGHLIGHT_RULER]?: true }
const mdWithEqualHighlight = markdownIt as MarkdownItWithEqualHighlight
if (!mdWithEqualHighlight[LUNA_EQUAL_HIGHLIGHT_RULER]) {
  mdWithEqualHighlight[LUNA_EQUAL_HIGHLIGHT_RULER] = true
  registerLunaEqualHighlightMarkdownRules(markdownIt)
}

/** [toc] on a single line: intercepted before paragraph to avoid being parsed into a link reference paragraph*/
const LUNA_TOC_RULER = Symbol('lunaTocDirectiveRuler')
type MarkdownItWithLuna = MarkdownIt & { [LUNA_TOC_RULER]?: true }
const mdWithToc = markdownIt as MarkdownItWithLuna
if (!mdWithToc[LUNA_TOC_RULER]) {
  mdWithToc[LUNA_TOC_RULER] = true
  markdownIt.block.ruler.before('paragraph', 'luna_toc_directive', (state, startLine, _endLine, silent) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (pos >= max) return false
    const line = state.src.slice(pos, max).replace(/\r$/u, '').trim()
    if (!LUNA_STANDALONE_TOC_LINE.test(line)) return false
    if (silent) return true
    state.line = startLine + 1
    const token = state.push('toc_directive', '', 0)
    token.map = [startLine, state.line]
    token.markup = '[toc]'
    return true
  })
}

/** The minimum state shape used by markdown-it block ruler*/
type LunaMdBlockState = {
  src: string
  bMarks: number[]
  eMarks: number[]
  tShift: number[]
  line: number
  lineMax: number
  push: (type: string, tag: string, nesting: number) => Token
}

function mdLineSlice(state: LunaMdBlockState, line: number): string {
  const pos = state.bMarks[line] + state.tShift[line]
  const max = state.eMarks[line]
  return state.src.slice(pos, max).replace(/\r$/u, '')
}

/** Reversible fence: non-HTML rawBlock is serialized into this format and restored to `luna_raw_block` token by this ruler*/
const LUNA_RAW_RULER = Symbol('lunaRawFenceRuler')
type MarkdownItWithRaw = MarkdownIt & { [LUNA_RAW_RULER]?: true }
const mdWithRaw = markdownIt as MarkdownItWithRaw
if (!mdWithRaw[LUNA_RAW_RULER]) {
  mdWithRaw[LUNA_RAW_RULER] = true
  markdownIt.block.ruler.before('fence', 'luna_raw_fence', (state, startLine, _endLine, silent) => {
    const s = state as LunaMdBlockState
    const line = mdLineSlice(s, startLine)
    if (!/^\s*```\s*luna-raw\s*$/iu.test(line)) return false
    if (silent) return true

    let next = startLine + 1
    let rawSource: LunaRawSource = 'unknown'
    if (next < s.lineMax) {
      const l1 = mdLineSlice(s, next)
      const sm = l1.match(/^\s*source:\s*(html|unknown|invalid)\s*$/iu)
      if (sm) {
        rawSource = sm[1].toLowerCase() as LunaRawSource
        next += 1
      }
    }

    const rawLines: string[] = []
    while (next < s.lineMax) {
      const L = mdLineSlice(s, next)
      if (/^\s*```\s*$/u.test(L)) {
        next += 1
        break
      }
      rawLines.push(s.src.slice(s.bMarks[next], s.eMarks[next]).replace(/\r$/u, ''))
      next += 1
    }

    const token = s.push('luna_raw_block', '', 0)
    token.map = [startLine, next]
    token.markup = '```luna-raw'
    token.attrSet('content', rawLines.join('\n'))
    token.attrSet('source', rawSource)
    s.line = next
    return true
  })
}

/** Consistent with `parseHeadingsFromPmDoc`: extract plain text from heading's inline token for use in slug*/
function collectInlinePlainTextForHeadingSlug(inline: Token): string {
  if (!inline.children?.length) return (inline.content ?? '').replace(/\s+/g, ' ').trim()
  const parts: string[] = []
  const walk = (nodes: Token[]) => {
    for (const t of nodes) {
      if (t.type === 'text' || t.type === 'code_inline') parts.push(t.content)
      else if (t.type === 'emoji') parts.push(t.content || '')
      else if (t.type === 'softbreak') parts.push(' ')
      else if (t.children?.length) walk(t.children)
    }
  }
  walk(inline.children)
  return parts.join('').trim()
}

type HeadingSourceLoc = { id: string; startLine0: number }

/**
 * Use the same markdown-it instance as `parseMarkdownToDoc` to parse the starting line of the title in the source code (0-based),
 * Line numbers map back to the original Markdown on disk (the CodeMirror display content), consistent with the `parseOutlineHeadingsFromMarkdown` / PM outline id.
 */
function headingSourceLocationsFromMarkdown(markdown: string): HeadingSourceLoc[] {
  const { text: src, preLineToRawLine } = preprocessLunaMarkdownAdmonitionsWithLineMap(markdown)
  const tokens = markdownIt.parse(src, {}) as Token[]
  const out: HeadingSourceLoc[] = []
  const slugger = new GithubSlugger()
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'heading_open' || t.map == null) continue
    let inline: Token | null = null
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'heading_close') break
      if (tokens[j].type === 'inline') {
        inline = tokens[j]
        break
      }
    }
    if (!inline) continue
    const title = collectInlinePlainTextForHeadingSlug(inline)
    if (!title) continue
    const preLine0 = t.map[0]
    const rawLine0 = preLineToRawLine[preLine0] ?? preLine0
    out.push({ id: slugger.slug(title), startLine0: rawLine0 })
  }
  return out
}

/** Outline id → source code line number (1-based) for CodeMirror to jump to; has the same origin as `parseOutlineHeadingsFromMarkdown`*/
export function sourceLineNumberForHeadingId(markdown: string, targetId: string): number | null {
  if (!targetId) return null
  for (const r of headingSourceLocationsFromMarkdown(markdown)) {
    if (r.id === targetId) return r.startLine0 + 1
  }
  return null
}

/** ATX/Quotation block title: Skip the `>` and `#+` prefixes and locate the starting column of the title body*/
export function headingContentStartOffsetInLine(lineText: string): number {
  const m = lineText.match(/^(\s*(?:>+\s*)*)#+\s*/)
  return m ? m[0].length : 0
}

/** Outline id → Source document offset (start of title text), must be of the same origin as `view.state.doc` markdown*/
export function sourceDocPosForHeadingId(markdown: string, targetId: string): number | null {
  const ln = sourceLineNumberForHeadingId(markdown, targetId)
  if (ln == null) return null
  const lines = markdown.split('\n')
  const lineText = lines[ln - 1] ?? ''
  let offset = 0
  for (let i = 0; i < ln - 1; i++) offset += lines[i].length + 1
  return offset + headingContentStartOffsetInLine(lineText)
}

/** The slug of the latest title before the cursor (including the current line), for highlighting in the source mode sidebar; consistent with PM outline id rules*/
export function activeHeadingIdBeforeMarkdownOffset(markdown: string, cursorOffset: number): string {
  const clamped = Math.min(Math.max(0, cursorOffset), markdown.length)
  const lineIdx = markdown.slice(0, clamped).split('\n').length - 1
  let lastId = ''
  for (const r of headingSourceLocationsFromMarkdown(markdown)) {
    if (r.startLine0 > lineIdx) break
    lastId = r.id
  }
  return lastId
}

/** Incremented to invalidate cached MarkdownParser in WeakMap after token/getAttrs logic changes (to avoid HMR stale handlers).*/
const LUNA_MARKDOWN_PARSER_CACHE_REV = 12
type CachedMarkdownParser = { rev: number; parser: MarkdownParser }
const markdownParserCache = new WeakMap<Schema, CachedMarkdownParser>()
const markdownSerializerCache = new WeakMap<Schema, MarkdownSerializer>()

const tiptapMarkdownTokens: Record<string, ParseSpec> = {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: { block: 'listItem' },
  bullet_list: { block: 'bulletList' },
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'tableRow' },
  th: { block: 'tableHeader', getAttrs: (tok) => gfmCellAlignAttrsFromMdItToken(tok) },
  td: { block: 'tableCell', getAttrs: (tok) => gfmCellAlignAttrsFromMdItToken(tok) },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (tok) => ({ start: Number(tok.attrGet('start')) || 1 }),
  },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) || 1 }),
  },
  code_block: { block: 'codeBlock', noCloseToken: true },
  fence: {
    block: 'codeBlock',
    getAttrs: (tok) => parseCodeFenceInfo(tok.info),
    noCloseToken: true,
  },
  hr: { node: 'horizontalRule' },
  /** markdown-it-deflist */
  dl: { block: 'definitionList' },
  dt: { block: 'definitionTerm' },
  dd: { block: 'definitionDescription' },
  /** Corresponds to the TipTap `tocDirective` node; produced by the markdown-it block rule `luna_toc_directive`*/
  toc_directive: { node: 'tocDirective' },
  footnote_ref: {
    node: 'footnoteRef',
    noCloseToken: true,
    getAttrs: (tok) => ({ label: String(tok.content ?? '').trim(), index: 0, preview: '' }),
  },
  footnote_def: {
    block: 'footnoteDef',
    noCloseToken: true,
    getAttrs: (tok) => {
      const meta = (tok as Token & { meta?: { label?: string } }).meta
      return { label: String(meta?.label ?? '').trim() }
    },
  },
  link_reference_def: {
    node: 'linkReferenceDef',
    noCloseToken: true,
    getAttrs: (tok) => {
      const meta = (tok as Token & { meta?: { label?: string; href?: string; title?: string } }).meta
      return {
        label: String(meta?.label ?? '').trim(),
        href: String(meta?.href ?? '').trim(),
        title: meta?.title ? String(meta.title) : null,
      }
    },
  },
  /** Produced by `luna_raw_fence` ruler, corresponding to `rawBlock`*/
  luna_raw_block: {
    node: 'rawBlock',
    noCloseToken: true,
    getAttrs: (tok) => ({
      content: tok.attrGet('content') ?? '',
      source: normalizeLunaRawSource(tok.attrGet('source')),
    }),
  },
  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
      alt: tok.children?.[0]?.content || null,
    }),
  },
  softbreak: { node: 'hardBreak' },
  hardbreak: { node: 'hardBreak' },
  /** markdown-it-emoji `emoji` token → `emoji` node (the only exit for serialization is `:name:`)*/
  emoji: {
    node: 'emoji',
    noCloseToken: true,
    getAttrs: (tok) => ({
      value: String(tok.markup ?? '').trim(),
    }),
  },
  math_inline: {
    node: 'inlineMath',
    getAttrs: (tok) => ({ latex: String(tok.content ?? '').trim() }),
    noCloseToken: true,
  },
  math_inline_double: {
    node: 'inlineMath',
    getAttrs: (tok) => ({ latex: String(tok.content ?? '').trim() }),
    noCloseToken: true,
  },
  math_block: {
    node: 'blockMath',
    noCloseToken: true,
    getAttrs: (tok) => ({ latex: String(tok.content ?? '').trim() }),
  },
  math_block_eqno: {
    node: 'blockMath',
    noCloseToken: true,
    getAttrs: (tok) => ({ latex: String(tok.content ?? '').trim() }),
  },
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  s: { mark: 'strike' },
  link: {
    mark: 'link',
    getAttrs: (tok) => {
      const href = tok.attrGet('href') || ''
      return {
        href,
        title: isLunaAssetHref(href) ? null : tok.attrGet('title') || null,
      }
    },
  },
  /** markdown-it-sup / markdown-it-sub: `X^2^`, `H~2~O` (consistent with Typora; `~~` is still strikethrough)*/
  sup: { mark: 'superscript' },
  sub: { mark: 'subscript' },
  code_inline: { mark: 'code', noCloseToken: true },
  luna_equal_highlight: { mark: 'highlight' },
  html_block: {
    node: 'rawBlock',
    noCloseToken: true,
    getAttrs: (tok) => ({
      content: String(tok.content ?? '').replace(/\n+$/u, ''),
      source: 'html' as const,
    }),
  },
  html_inline: {
    node: 'rawInline',
    noCloseToken: true,
    getAttrs: (tok) => ({
      content: String(tok.content ?? ''),
      source: 'html' as const,
    }),
  },
}

function liftMermaidCodeBlocks(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const mermaidType = schema.nodes.mermaidBlock
  const codeBlock = schema.nodes.codeBlock
  if (!mermaidType || !codeBlock) return doc

  type Hit = { pos: number; node: ProseMirrorNode }
  const hits: Hit[] = []
  doc.descendants((node, pos) => {
    if (node.type !== codeBlock) return
    const lang = String(node.attrs.language ?? '')
      .trim()
      .toLowerCase()
    if (lang !== 'mermaid') return
    hits.push({ pos, node })
  })
  if (hits.length === 0) return doc
  hits.sort((a, b) => b.pos - a.pos)
  let tr = new Transform(doc)
  for (const { pos, node } of hits) {
    const source = node.textContent
    const next = mermaidType.create({ source, blockId: newMermaidBlockId() })
    tr = tr.replaceWith(pos, pos + node.nodeSize, next)
  }
  return tr.doc
}

function liftTyporaCallouts(doc: ProseMirrorNode, schema: Schema, markdown?: string): ProseMirrorNode {
  const calloutType = schema.nodes.callout
  const bq = schema.nodes.blockquote
  const paragraphType = schema.nodes.paragraph
  if (!calloutType || !bq || !paragraphType) return doc
  const leadingBlankCounts = markdown ? collectLeadingBlankQuoteLineCounts(markdown) : []
  let calloutOrdinal = 0

  const stripLeadingCalloutMarkerFromParagraph = (paragraph: ProseMirrorNode): ProseMirrorNode | null => {
    if (paragraph.type.name !== 'paragraph' || paragraph.childCount === 0) return null
    const prefix = paragraph.textContent.match(new RegExp(`^\\[!\\s*(${CALLOUT_BRACKET_TAGS})\\s*\\]\\s*`, 'iu'))?.[0]
    if (!prefix) return null
    let remaining = prefix.length
    const children: ProseMirrorNode[] = []
    let stripped = false

    paragraph.forEach((child) => {
      if (remaining <= 0) {
        children.push(child)
        return
      }
      if (!child.isText) {
        children.push(child)
        return
      }
      const text = child.text ?? ''
      if (!text.length) return
      if (text.length <= remaining) {
        remaining -= text.length
        stripped = true
        return
      }
      children.push(schema.text(text.slice(remaining), child.marks))
      remaining = 0
      stripped = true
    })

    if (!stripped || remaining > 0) return null
    const normalizedChildren =
      children.length > 0 && children[0]?.type.name === 'hardBreak' ? children.slice(1) : children
    return paragraph.copy(
      normalizedChildren.length > 0 ? Fragment.fromArray(normalizedChildren) : Fragment.empty,
    )
  }

  type Hit = {
    pos: number
    node: ProseMirrorNode
    kind: CalloutKind
    firstBodyParagraph: ProseMirrorNode | null
    leadingBlankLines: number
  }
  const hits: Hit[] = []
  doc.descendants((node, pos) => {
    if (node.type !== bq || node.childCount < 1) return
    const first = node.child(0)
    if (first.type.name !== 'paragraph' || first.content.size === 0) return
    const text = first.textContent
    const led = parseCalloutLeadingParagraph(text)
    const kind: CalloutKind | null = led
      ? led.kind
      : (() => {
          const k = matchCalloutFirstLine(text.trim())
          if (!k) return null
          return k
        })()
    if (!kind) return
    const firstBodyParagraph = led ? stripLeadingCalloutMarkerFromParagraph(first) : null
    const leadingBlankLines = leadingBlankCounts[calloutOrdinal] ?? 0
    calloutOrdinal += 1
    hits.push({ pos, node, kind, firstBodyParagraph, leadingBlankLines })
  })
  if (hits.length === 0) return doc
  hits.sort((a, b) => b.pos - a.pos)
  let tr = new Transform(doc)
  for (const { pos, node, kind, firstBodyParagraph, leadingBlankLines } of hits) {
    const parts: ProseMirrorNode[] = []
    for (let i = 0; i < leadingBlankLines; i += 1) parts.push(paragraphType.create())
    if (firstBodyParagraph) {
      if (firstBodyParagraph.content.size > 0) parts.push(firstBodyParagraph)
      for (let i = 1; i < node.childCount; i += 1) parts.push(node.child(i))
    } else {
      for (let i = 1; i < node.childCount; i += 1) parts.push(node.child(i))
    }
    const inner =
      parts.length > 0
        ? Fragment.fromArray(parts)
        : Fragment.from(schema.nodes.paragraph.create())
    const c = calloutType.create({ kind }, inner)
    tr = tr.replaceWith(pos, pos + node.nodeSize, c)
  }
  return tr.doc
}

function isMarkdownFenceToggleLine(line: string): boolean {
  return /^\s*(?:`{3,}|~{3,})\s*[^\n]*$/u.test(line)
}

function collectLeadingBlankQuoteLineCounts(markdown: string): number[] {
  const src = preprocessMarkdownForEditParse(markdown)
  const lines = src.split('\n')
  const counts: number[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (isMarkdownFenceToggleLine(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (!/^\s*>\s*\[![^\]]+\]/u.test(line)) continue

    let blanks = 0
    let j = i + 1
    while (j < lines.length) {
      const current = lines[j] ?? ''
      if (!/^\s*>/u.test(current)) break
      const body = current.replace(/^\s*>\s?/u, '')
      if (body.trim().length > 0) break
      blanks += 1
      j += 1
    }
    counts.push(blanks)

    while (j < lines.length && /^\s*>/u.test(lines[j] ?? '')) j += 1
    i = j - 1
  }

  return counts
}

function liftStandaloneTocDirectiveParagraphs(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const t = buildLiftStandaloneTocDirectiveTransform(doc, schema)
  return t ? t.doc : doc
}

/** Assign display numbers to footnote references and bind definition preview copy*/
function liftFootnoteMetadata(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const refType = schema.nodes.footnoteRef
  const defType = schema.nodes.footnoteDef
  if (!refType || !defType) return doc

  const defText = new Map<string, string>()
  doc.descendants((node) => {
    if (node.type !== defType) return
    const label = String(node.attrs.label ?? '').trim()
    if (!label) return
    defText.set(label, node.textContent.trim())
  })

  const labelToIndex = new Map<string, number>()
  let nextIndex = 0
  const refHits: { pos: number; node: ProseMirrorNode; label: string }[] = []
  doc.descendants((node, pos) => {
    if (node.type !== refType) return
    const label = String(node.attrs.label ?? '').trim()
    if (!label) return
    if (!labelToIndex.has(label)) {
      nextIndex += 1
      labelToIndex.set(label, nextIndex)
    }
    refHits.push({ pos, node, label })
  })

  if (refHits.length === 0) return doc

  let tr = new Transform(doc)
  for (let i = refHits.length - 1; i >= 0; i -= 1) {
    const { pos, node, label } = refHits[i]!
    const index = labelToIndex.get(label) ?? 0
    const preview = defText.get(label) ?? ''
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      index,
      preview,
    })
  }
  return tr.doc
}

type FootnoteDefParseState = {
  openNode: (type: NodeType, attrs: Attrs | null) => void
  closeNode: () => void
  addText: (text: string) => void
}

function patchFootnoteDefMarkdownHandlers(schema: Schema, parser: MarkdownParser): void {
  const footnoteDef = schema.nodes.footnoteDef
  if (!footnoteDef) return
  const handlers = parser as unknown as {
    tokenHandlers: Record<string, (state: FootnoteDefParseState, tok: Token) => void>
  }
  handlers.tokenHandlers.footnote_def = (state, tok) => {
    const meta = (tok as Token & { meta?: { label?: string; content?: string } }).meta
    const label = String(meta?.label ?? '').trim()
    const content = String(meta?.content ?? tok.content ?? '').trim()
    state.openNode(footnoteDef, { label })
    if (content) state.addText(content)
    state.closeNode()
  }
}

/**
 * TipTap's tableCell / tableHeader is `content: 'block+'`, and must have block-level packages such as paragraph;
 * By default, prosemirror-markdown inserts markdown-it's `inline` directly into the cell, causing createAndFill to fail and the cell to be discarded.
 * After serialization, the table contents are cleared (data is lost). Automatically insert a paragraph within th/td.
 */
type MarkdownCellParseState = {
  openNode: (type: NodeType, attrs: Attrs | null) => void
  closeNode: () => void
}

function patchTableCellMarkdownHandlers(schema: Schema, parser: MarkdownParser): void {
  const paragraph = schema.nodes.paragraph
  if (!paragraph) return

  const handlers = parser as unknown as {
    tokenHandlers: Record<string, (state: MarkdownCellParseState, ...args: unknown[]) => void>
  }
  const { tokenHandlers } = handlers

  const origThOpen = tokenHandlers['th_open']
  const origThClose = tokenHandlers['th_close']
  const origTdOpen = tokenHandlers['td_open']
  const origTdClose = tokenHandlers['td_close']
  if (!origThOpen || !origThClose || !origTdOpen || !origTdClose) return

  tokenHandlers['th_open'] = (state, tok, tokens, i) => {
    origThOpen(state, tok, tokens, i)
    state.openNode(paragraph, null)
  }
  tokenHandlers['th_close'] = (state, ...args) => {
    state.closeNode()
    origThClose(state, ...args)
  }
  tokenHandlers['td_open'] = (state, tok, tokens, i) => {
    origTdOpen(state, tok, tokens, i)
    state.openNode(paragraph, null)
  }
  tokenHandlers['td_close'] = (state, ...args) => {
    state.closeNode()
    origTdClose(state, ...args)
  }
}

function getMarkdownParser(schema: Schema): MarkdownParser {
  const cached = markdownParserCache.get(schema)
  if (cached?.rev === LUNA_MARKDOWN_PARSER_CACHE_REV) return cached.parser
  const parser = new MarkdownParser(schema, markdownIt, tiptapMarkdownTokens)
  patchTableCellMarkdownHandlers(schema, parser)
  patchFootnoteDefMarkdownHandlers(schema, parser)
  markdownParserCache.set(schema, { rev: LUNA_MARKDOWN_PARSER_CACHE_REV, parser })
  return parser
}

function backticksFor(node: ProseMirrorNode, side: number): string {
  let len = 0
  const ticks = /`+/gu
  let match: RegExpExecArray | null
  if (node.isText) {
    while ((match = ticks.exec(node.text ?? ''))) len = Math.max(len, match[0].length)
  }
  let result = len > 0 && side > 0 ? ' `' : '`'
  for (let i = 0; i < len; i += 1) result += '`'
  if (len > 0 && side < 0) result += ' '
  return result
}

function isPlainUrl(link: Mark, parent: ProseMirrorNode, index: number): boolean {
  if (link.attrs.title || !/^\w+:/u.test(link.attrs.href)) return false
  const content = parent.child(index)
  if (!content.isText || content.text !== link.attrs.href || content.marks[content.marks.length - 1] !== link) {
    return false
  }
  return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks)
}

/** mailto and the visible text is equal to the email address and there is no query, serialize to bare text so that the source code mode remains `a@b.c`*/
function isMailtoBareEmailLink(link: Mark, parent: ProseMirrorNode, index: number): boolean {
  if (link.attrs.title) return false
  const href = String(link.attrs.href || '').trim()
  const m = /^mailto:([^?#]+)$/iu.exec(href)
  if (!m) return false
  let addr = m[1]
  try {
    addr = decodeURIComponent(addr)
  } catch {
    /*keep original addr*/
  }
  const content = parent.child(index)
  if (!content.isText || content.text !== addr) return false
  return index === parent.childCount - 1 || !link.isInSet(parent.child(index + 1).marks)
}

function getMarkdownSerializer(schema: Schema): MarkdownSerializer {
  const cached = markdownSerializerCache.get(schema)
  if (cached) return cached
  const serializer = new MarkdownSerializer(
    {
      callout(state, node) {
        const tag = calloutFirstLineForKind(String(node.attrs.kind || 'note'))
        state.write(`> ${tag}`)
        state.write('\n')
        state.wrapBlock('> ', null, node, () => state.renderContent(node))
      },
      blockquote(state, node) {
        state.wrapBlock('> ', null, node, () => state.renderContent(node))
      },
      mermaidBlock(state, node) {
        state.write('```mermaid\n')
        state.text(String(node.attrs.source ?? ''), false)
        state.write('\n```')
        state.closeBlock(node)
      },
      codeBlock(state, node) {
        const backticks = node.textContent.match(/`{3,}/gmu)
        const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : '```'
        const info = formatCodeFenceInfo(node.attrs as {
          language?: string | null
          folded?: boolean | null
          diffMode?: boolean | null
        })
        state.write(info ? `${fence}${info}\n` : `${fence}\n`)
        state.text(node.textContent, false)
        state.write('\n')
        state.write(fence)
        state.closeBlock(node)
      },
      heading(state, node) {
        state.write(`${state.repeat('#', node.attrs.level)} `)
        state.renderInline(node, false)
        state.closeBlock(node)
      },
      horizontalRule(state, node) {
        state.write(node.attrs.markup || '---')
        state.closeBlock(node)
      },
      definitionList(state, node) {
        node.forEach((child, _, i) => {
          if (i > 0) state.ensureNewLine()
          if (child.type.name === 'definitionTerm') {
            state.renderInline(child)
            state.write('\n')
          } else if (child.type.name === 'definitionDescription') {
            state.write(':   ')
            const first = child.firstChild
            if (first?.type.name === 'paragraph' && child.childCount === 1) {
              state.renderInline(first)
              state.closeBlock(child)
            } else {
              state.renderContent(child)
            }
          }
        })
        state.closeBlock(node)
      },
      definitionTerm(state, node) {
        state.renderInline(node)
        state.write('\n')
      },
      definitionDescription(state, node) {
        state.write(':   ')
        const first = node.firstChild
        if (first?.type.name === 'paragraph' && node.childCount === 1) {
          state.renderInline(first)
        } else {
          state.renderContent(node)
        }
        state.closeBlock(node)
      },
      tocDirective(state, node) {
        state.write('[toc]')
        state.closeBlock(node)
      },
      footnoteDef(state, node) {
        const label = String(node.attrs.label ?? '').trim()
        const guarded = validateASTBeforeCommit({ type: 'footnoteDef', label, content: node.textContent ?? '' })
        state.write(`[^${label}]: `)
        // Footnote definition must be serialized from normalized AST text only.
        // Avoid generic renderInline() fallback here, which can route through text escaping.
        state.text(guarded.value, false)
        state.closeBlock(node)
      },
      footnoteRef(state, node) {
        const label = String(node.attrs.label ?? '').trim()
        if (label) state.write(`[^${label}]`)
      },
      linkReferenceDef(state, node) {
        const line = formatLinkReferenceDefLine(
          String(node.attrs.label ?? ''),
          String(node.attrs.href ?? ''),
          node.attrs.title,
        )
        if (line.trim()) state.write(line)
        state.closeBlock(node)
      },
      rawBlock(state, node) {
        const content = String(node.attrs.content ?? '')
        const source = normalizeLunaRawSource(node.attrs.source)
        if (source === 'html') {
          const body = content.endsWith('\n') ? content : `${content}\n`
          state.write(body)
          state.closeBlock(node)
          return
        }
        state.write('```luna-raw\n')
        state.write(`source: ${source}\n`)
        state.write(content)
        state.write('\n```\n')
        state.closeBlock(node)
      },
      bulletList(state, node) {
        state.renderList(node, '  ', () => '- ')
      },
      orderedList(state, node) {
        const start = node.attrs.start || 1
        const maxWidth = String(start + node.childCount - 1).length
        const space = state.repeat(' ', maxWidth + 2)
        state.renderList(node, space, (i) => {
          const n = String(start + i)
          return `${state.repeat(' ', maxWidth - n.length)}${n}. `
        })
      },
      table(state, node) {
        if (node.childCount === 0) {
          state.closeBlock(node)
          return
        }
        let map: TableMap | null
        try {
          map = TableMap.get(node)
        } catch {
          map = null
        }
        const colCount = map?.width ?? node.child(0).childCount

        for (let rowIndex = 0; rowIndex < node.childCount; rowIndex += 1) {
          const row = node.child(rowIndex)
          const cells: string[] = []
          for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
            const raw = row.child(cellIndex).textContent.replace(/\s*\n\s*/gu, ' ').trim()
            cells.push(raw.replace(/\\/gu, '\\\\').replace(/\|/gu, '\\|') || ' ')
          }
          state.write(`| ${cells.join(' | ')} |\n`)
          if (rowIndex === 0) {
            const seps: string[] = []
            for (let c = 0; c < colCount; c += 1) {
              const a = map ? columnLunaTextAlignForGfm(node, c, map) : null
              seps.push(gfmTableSeparatorForAlign(a))
            }
            state.write(`| ${seps.join(' | ')} |\n`)
          }
        }
        state.closeBlock(node)
      },
      tableRow(state, node) {
        state.renderContent(node)
      },
      tableCell(state, node) {
        state.renderContent(node)
      },
      tableHeader(state, node) {
        state.renderContent(node)
      },
      listItem(state, node) {
        state.renderContent(node)
      },
      taskList(state, node) {
        state.renderContent(node)
      },
      taskItem(state, node) {
        const checked = node.attrs.checked ? 'x' : ' '
        state.wrapBlock('  ', `- [${checked}] `, node, () => state.renderContent(node))
      },
      paragraph(state, node, parent) {
        const st = state as LunaMarkdownSerializerState
        st.lunaSerParagraphParent = parent
        const isEmpty = node.content.size === 0
        const inQuotedContainer = parent.type.name === 'callout' || parent.type.name === 'blockquote'
        const standaloneToc =
          !isEmpty &&
          parent.type.name === 'doc' &&
          node.childCount === 1 &&
          node.child(0).isText &&
          node.child(0).marks.length === 0 &&
          LUNA_STANDALONE_TOC_LINE.test(node.child(0).text ?? '')
        try {
          if (isEmpty) {
            if (!inQuotedContainer) {
              // Flush the previous block delimiter before replacing `closed`; otherwise
              // prosemirror-markdown drops the empty paragraph and blank lines vanish on save.
              state.write()
            }
          } else if (standaloneToc) {
            withRawTextSerializerScope(state, () => state.renderInline(node))
          } else {
            state.renderInline(node)
          }
          state.closeBlock(node)
        } finally {
          delete st.lunaSerParagraphParent
        }
      },
      image(state, node) {
        const src = String(node.attrs.src || '').replace(/[()]/gu, '\\$&')
        const alt = state.esc(node.attrs.alt || '')
        const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/gu, '\\"')}"` : ''
        state.write(`![${alt}](${src}${title})`)
      },
      inlineMath(state, node) {
        state.write('$')
        state.write(String(node.attrs.latex ?? ''))
        state.write('$')
      },
      blockMath(state, node) {
        state.write('$$\n')
        state.write(String(node.attrs.latex ?? ''))
        state.write('\n$$')
        state.closeBlock(node)
      },
      hardBreak(state, node, parent, index) {
        for (let i = index + 1; i < parent.childCount; i += 1) {
          if (parent.child(i).type !== node.type) {
            state.write('\\\n')
            return
          }
        }
        if (index > 0) {
          state.write('\\\n')
        }
      },
      emoji(state, node) {
        const v = String(node.attrs.value ?? '').trim()
        if (!v) return
        state.write(':')
        state.write(v)
        state.write(':')
      },
      rawInline(state, node) {
        state.write(String(node.attrs.content ?? ''))
      },
      text(state, node, parent) {
        const txt = node.text ?? ''
        const st = state as LunaMarkdownSerializerState
        if (node.type.name !== 'text') {
          throw new Error(`escape on non-text node forbidden: ${node.type.name}`)
        }
        void parent
        const escape = (st.lunaRawTextDepth ?? 0) === 0
        if (escape) {
          state.write(escapeLunaPlainText(txt))
        } else {
          state.text(txt, false)
        }
      },
    },
    {
      bold: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
      italic: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
      strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
      highlight: { open: '==', close: '==', mixable: true, expelEnclosingWhitespace: true },
      superscript: { open: '^', close: '^', mixable: true, expelEnclosingWhitespace: false },
      subscript: { open: '~', close: '~', mixable: true, expelEnclosingWhitespace: false },
      link: {
        open(state, mark, parent, index) {
          const st = state as LunaMarkdownSerializerState & { inMailtoBare?: boolean }
          if (isMailtoBareEmailLink(mark, parent, index)) {
            st.inMailtoBare = true
            st.lunaRawTextDepth = (st.lunaRawTextDepth ?? 0) + 1
            return ''
          }
          st.inAutolink = isPlainUrl(mark, parent, index)
          if (st.inAutolink) st.lunaRawTextDepth = (st.lunaRawTextDepth ?? 0) + 1
          return st.inAutolink ? '<' : '['
        },
        close(state, mark) {
          const st = state as LunaMarkdownSerializerState & { inMailtoBare?: boolean }
          if (st.inMailtoBare) {
            st.inMailtoBare = undefined
            st.lunaRawTextDepth = Math.max(0, (st.lunaRawTextDepth ?? 1) - 1)
            return ''
          }
          const { inAutolink } = st
          st.inAutolink = undefined
          if (inAutolink) {
            st.lunaRawTextDepth = Math.max(0, (st.lunaRawTextDepth ?? 1) - 1)
            return '>'
          }
          const href = String(mark.attrs.href || '').replace(/[()"]/gu, '\\$&')
          const title =
            isLunaAssetHref(mark.attrs.href) || !mark.attrs.title
              ? ''
              : ` "${String(mark.attrs.title).replace(/"/gu, '\\"')}"`
          return `](${href}${title})`
        },
        mixable: true,
      },
      code: {
        open(_state, _mark, parent, index) {
          return backticksFor(parent.child(index), -1)
        },
        close(_state, _mark, parent, index) {
          return backticksFor(parent.child(index - 1), 1)
        },
        escape: false,
      },
      textColor: {
        open(_state, mark) {
          const color = normalizeTextColor(mark.attrs.color)
          if (!color) return ''
          return `<span style="color:${color};">`
        },
        close: '</span>',
        mixable: true,
        expelEnclosingWhitespace: true,
      },
      underline: {
        open: '<u>',
        close: '</u>',
        mixable: true,
        expelEnclosingWhitespace: true,
      },
    },
    { hardBreakNodeName: 'hardBreak', strict: false },
  )
  // Touch the schema so the cache key and serializer creation stay tied to the active TipTap schema.
  void schema
  markdownSerializerCache.set(schema, serializer)
  return serializer
}

function createFallbackMarkdownDoc(schema: Schema, source: string): ProseMirrorNode {
  const docType = schema.nodes.doc
  const rawBlockType = schema.nodes.rawBlock
  if (docType && rawBlockType) {
    const rb = rawBlockType.create({
      content: source,
      source: 'invalid',
    })
    return docType.create(null, Fragment.from(rb))
  }
  const paragraphType = schema.nodes.paragraph
  if (!docType || !paragraphType) {
    const top = schema.topNodeType
    return top.createAndFill() ?? top.create()
  }
  const text = source ? schema.text(source) : null
  const para = paragraphType.create(null, text ? Fragment.from(text) : Fragment.empty)
  return docType.create(null, Fragment.from(para))
}

export type ParseMarkdownToDocOptions = {
  /** When false, skip re-inserting empty paragraphs from source blank-line layout (compare / round-trip paths). */
  liftBlankLines?: boolean
}

export function parseMarkdownToDoc(
  markdown: string,
  schema: Schema,
  options?: ParseMarkdownToDocOptions,
): ProseMirrorNode {
  const fallback = () => createFallbackMarkdownDoc(schema, markdown)
  let doc: ProseMirrorNode
  try {
    const parser = getMarkdownParser(schema)
    doc = parser.parse(preprocessMarkdownForEditParse(markdown))
  } catch {
    return fallback()
  }

  try {
    doc = liftTyporaCallouts(doc, schema, markdown)
  } catch {
    /*Keep the parsing results that have not been promoted to callout to avoid the entire article falling back to a single fallback*/
  }

  try {
    doc = liftMermaidCodeBlocks(doc, schema)
  } catch {
    /*Keep codeBlock parsing results*/
  }

  try {
    doc = normalizeCodeBlockTrailingEmptyLinesInDoc(doc, schema)
  } catch {
    /*Keep codeBlock body as parsed*/
  }

  try {
    doc = liftMarkdownTaskLists(doc, schema)
  } catch {
    /*Preserve list structures that are not promoted to taskList*/
  }

  try {
    doc = liftStandaloneTocDirectiveParagraphs(doc, schema)
  } catch {
    /*Preserve unpromoted paragraph structure*/
  }

  try {
    doc = liftFootnoteDefParagraphs(doc, schema)
  } catch {
    /*Keep paragraph structure*/
  }

  try {
    doc = liftFootnoteMetadata(doc, schema)
  } catch {
    /*Keep footnote parsing results*/
  }

  try {
    doc = liftInlineHtmlFormattingMarksIterated(doc, schema)
  } catch {
    /*Preserve unraised rawInline HTML*/
  }

  try {
    if (options?.liftBlankLines !== false) {
      doc = liftBlankLineParagraphs(doc, schema, markdown)
    }
  } catch {
    /*Keep doc without blank-line lift*/
  }

  return doc
}

/**
 * Internal serializer implementation backing `editor/compiler/markdownCompiler`.
 * External callers should prefer the compiler surface or canonical markdown adapters.
 */
export function serializeDocToMarkdownStrict(doc: ProseMirrorNode, schema: Schema): ProductionMarkdown {
  let lifted = doc
  try {
    lifted = liftFootnoteDefParagraphs(lifted, schema)
  } catch {
    /*Keep original doc*/
  }
  try {
    lifted = liftPlainTextFootnoteRefs(lifted, schema)
  } catch {
    /*Keep original doc*/
  }
  const serializer = getMarkdownSerializer(schema)
  assertSerializerNodeCoverage(serializer, lifted)
  const serialized = serializer.serialize(lifted) as ProductionMarkdown
  const trailingEmptyParagraphs = countTrailingEmptyParagraphs(lifted)
  return restoreSerializedLeadingBlankCalloutLines(
    normalizeSerializedBlankQuoteLines(alignSerializedTrailingBlankLines(serialized, trailingEmptyParagraphs)),
    lifted,
  ) as ProductionMarkdown
}

function normalizeSerializedBlankQuoteLines(markdown: string): string {
  return markdown.replace(/^(\s*>)[ \t]+$/gmu, '$1')
}

function restoreSerializedLeadingBlankCalloutLines(markdown: string, doc: ProseMirrorNode): string {
  const lines = markdown.split('\n')
  let searchFrom = 0

  doc.forEach((node) => {
    if (node.type.name !== 'callout') return
    let leadingBlankParagraphs = 0
    while (leadingBlankParagraphs < node.childCount) {
      const child = node.child(leadingBlankParagraphs)
      if (child.type.name !== 'paragraph' || child.content.size !== 0) break
      leadingBlankParagraphs += 1
    }
    const marker = `> ${calloutFirstLineForKind(String(node.attrs.kind || 'note'))}`
    let markerLine = -1
    for (let i = searchFrom; i < lines.length; i += 1) {
      if ((lines[i] ?? '') === marker) {
        markerLine = i
        break
      }
    }
    if (markerLine < 0) return
    if (leadingBlankParagraphs <= 0) {
      searchFrom = markerLine + 1
      return
    }
    let runEnd = markerLine + 1
    while (runEnd < lines.length && /^\s*>[ \t]*$/u.test(lines[runEnd] ?? '')) runEnd += 1
    lines.splice(markerLine + 1, runEnd - (markerLine + 1), ...Array(leadingBlankParagraphs).fill('>'))
    searchFrom = markerLine + 1 + leadingBlankParagraphs
  })

  return lines.join('\n')
}

export function serializeDocToMarkdownWithMode(
  doc: ProseMirrorNode,
  schema: Schema,
  mode: RenderMode,
): string {
  const compiled = serializeDocToMarkdownStrict(doc, schema)
  // Keep trailing blank lines from user content; production save must not trim them.
  if (mode === 'production') return compiled
  return compiled
}

export function serializeDocToMarkdown(doc: ProseMirrorNode, schema: Schema): string {
  return serializeDocToMarkdownWithMode(doc, schema, 'production')
}

/**
 *⌘/ Mode switch freeze path exclusive: same serializer as `serializeDocToMarkdown`,
 * **Do not** do `trimEnd` for the entire article to be consistent with the cumulative block prefix, CodeMirror `doc.toString()` line breaks at the end of the article, etc.
 */
export function serializeDocToMarkdownForModeBridge(doc: ProseMirrorNode, schema: Schema): string {
  return serializeDocToMarkdownWithMode(doc, schema, 'preview')
}

/** No error is thrown when serialization fails, so as to avoid silently swallowing update signals when synchronizing to an external buffer.*/
export function trySerializeDocToMarkdown(doc: ProseMirrorNode, schema: Schema): SerializeDocToMarkdownResult {
  try {
    return { ok: true, markdown: serializeDocToMarkdownWithMode(doc, schema, 'production') }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Serialize a single block-level node to Markdown (for title source editing, etc.)*/
export function serializeBlockNodeToMarkdown(node: ProseMirrorNode, schema: Schema): string {
  const doc = schema.nodes.doc.create(null, [node])
  return serializeDocToMarkdownStrict(doc, schema).replace(/\n+$/u, '')
}

/**
 * Parse a section of Markdown into a document and take the first top-level block (for header line submission).
 * The text will be trimmed before parsing; an empty string returns null.
 */
export function parseFirstMarkdownBlock(markdown: string, schema: Schema): ProseMirrorNode | null {
  const t = markdown.trimEnd()
  if (!t) return null
  const doc = parseMarkdownToDoc(`${t}\n`, schema)
  return doc.firstChild ?? null
}

/**
 * Serialize `[from, to)` fragments in the document to Markdown (for local source code layer).
 * The fragment package is reserialized in a temporary `paragraph`, so it works for inline ranges within the same paragraph.
 */
export function serializePmRangeToMarkdown(doc: ProseMirrorNode, schema: Schema, from: number, to: number): string {
  if (from >= to) return ''
  const slice = doc.slice(from, to)
  const para = schema.nodes.paragraph.create(null, slice.content)
  const wrap = schema.nodes.doc.create(null, [para])
  return serializeDocToMarkdownStrict(wrap, schema).replace(/\n+$/u, '').trimEnd()
}

/**
 * Parse a section of Markdown into a fragment of the "contents of a single top-level textblock" (used to replace partial inline).
 * Returns null if legal inline content cannot be obtained.
 */
export function parseMarkdownToInlineFragment(markdown: string, schema: Schema): Fragment | null {
  const t = markdown.trimEnd()
  if (!t) return null
  try {
    const doc = parseMarkdownToDoc(`${t}\n`, schema)
    const first = doc.firstChild
    if (!first || !first.isTextblock) return null
    return first.content
  } catch {
    return null
  }
}
