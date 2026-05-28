import { Extension } from '@tiptap/core'
import type { Selection } from '@tiptap/pm/state'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Mark, Node as PMNode, Schema } from '@tiptap/pm/model'
import type { ResolvedPos } from '@tiptap/pm/model'
import type { Mapping } from '@tiptap/pm/transform'
import { Mapping as MappingClass } from '@tiptap/pm/transform'
import type { EditorView } from '@tiptap/pm/view'

import { isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { parseHtmlCommentBody } from './lunaHtmlComment'
import { normalizeLunaRawSource } from './lunaRawBlock'
import { canonicalMarkdownSemantics } from '../markdown/canonicalMarkdownSemantics'
import {
  footnoteDefMarkdownLine,
  parseFootnoteDefMarkdownLine,
} from './lunaFootnoteDefLift'
import { validateASTBeforeCommit } from './astGuardrails'

/** Shared with plugin `setMeta` for title NodeView to trigger block level reveal*/
export const LUNA_INLINE_REVEAL_META = 'lunaInlineReveal' as const

export type LunaRevealState =
  | { mode: 'inline'; from: number; to: number; initialMd: string }
  | {
      mode: 'block'
      blockFrom: number
      blockTo: number
      innerFrom: number
      innerTo: number
      initialMd: string
      blockType: string
      blockAttrs?: Record<string, unknown>
    }

export type LunaInlineRevealMeta =
  | { action: 'start'; payload: LunaRevealState }
  | { action: 'clear' }

export const lunaInlineRevealPluginKey = new PluginKey<LunaRevealState | null>('lunaInlineReveal')

export function getActiveMarkdownSourceReveal(view: EditorView): LunaRevealState | null {
  return lunaInlineRevealPluginKey.getState(view.state) ?? null
}

export function commitActiveMarkdownSourceReveal(view: EditorView): boolean {
  const reveal = getActiveMarkdownSourceReveal(view)
  if (!reveal) return false
  performCommit(view, reveal)
  return true
}

/** Replace the inline section of the document with Markdown source code and enter reveal editing (for NodeView double-click, etc. to call)*/
export function startInlineMarkdownReveal(
  view: EditorView,
  from: number,
  to: number,
  initialMd: string,
  caretOffset?: number,
): void {
  const newTo = from + initialMd.length
  let tr = view.state.tr.replaceWith(from, to, view.state.schema.text(initialMd))
  const caret =
    caretOffset != null ? Math.max(from, Math.min(from + caretOffset, newTo)) : newTo
  tr = tr.setSelection(TextSelection.create(tr.doc, caret))
  tr = tr.setMeta(LUNA_INLINE_REVEAL_META, {
    action: 'start',
    payload: { mode: 'inline', from, to: newTo, initialMd },
  } satisfies LunaInlineRevealMeta)
  view.dispatch(tr)
}

function resolveHtmlCommentFromDom(
  view: EditorView,
  root: Element,
): { from: number; to: number; md: string } | null {
  let pos: number
  try {
    pos = view.posAtDOM(root, 0)
  } catch {
    return null
  }
  const doc = view.state.doc
  for (const check of [pos, pos - 1, pos + 1]) {
    if (check < 0 || check > doc.content.size) continue
    const node = doc.nodeAt(check)
    if (node?.type.name === 'rawInline' && normalizeLunaRawSource(node.attrs.source) === 'html') {
      const md = String(node.attrs.content ?? '').trim()
      if (parseHtmlCommentBody(md) == null) continue
      return { from: check, to: check + node.nodeSize, md }
    }
    const $p = doc.resolve(check)
    const before = $p.nodeBefore
    if (
      before?.type.name === 'rawInline' &&
      normalizeLunaRawSource(before.attrs.source) === 'html'
    ) {
      const md = String(before.attrs.content ?? '').trim()
      if (parseHtmlCommentBody(md) == null) continue
      return { from: check - before.nodeSize, to: check, md }
    }
  }
  return null
}

/** Allow "source code" mark after double-clicking (ordinary unmarked text will not enter reveal)*/
const REVEAL_MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'link', 'underline', 'textColor', 'highlight'])

function markSig(marks: readonly Mark[]): string {
  if (!marks.length) return ''
  return [...marks]
    .sort((a, b) => a.type.name.localeCompare(b.type.name))
    .map((m) => `${m.type.name}:${JSON.stringify(m.attrs)}`)
    .join('\0')
}

function marksRevealable(marks: readonly Mark[]): boolean {
  if (!marks.length) return false
  return marks.every((m) => REVEAL_MARK_TYPES.has(m.type.name))
}

function findChildAtPos($pos: ResolvedPos): { index: number; child: PMNode; from: number; to: number } | null {
  const parent = $pos.parent
  if (!parent.isTextblock) return null
  const base = $pos.start($pos.depth)
  let p = base
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i)
    const end = p + child.nodeSize
    if ($pos.pos >= p && $pos.pos < end) return { index: i, child, from: p, to: end }
    p = end
  }
  return null
}

function expandMarkedTextRange(
  parent: PMNode,
  base: number,
  hit: { index: number; child: PMNode; from: number; to: number },
): { from: number; to: number } {
  if (!hit.child.isText) {
    return { from: hit.from, to: hit.to }
  }
  const sig0 = markSig(hit.child.marks)
  if (!sig0) {
    return { from: hit.from, to: hit.to }
  }
  let lo = hit.index
  let hi = hit.index
  while (lo > 0) {
    const c = parent.child(lo - 1)
    if (!c.isText || markSig(c.marks) !== sig0) break
    lo--
  }
  while (hi + 1 < parent.childCount) {
    const c = parent.child(hi + 1)
    if (!c.isText || markSig(c.marks) !== sig0) break
    hi++
  }
  let from = base
  for (let i = 0; i < lo; i++) from += parent.child(i).nodeSize
  let to = from
  for (let i = lo; i <= hi; i++) to += parent.child(i).nodeSize
  return { from, to }
}

function resolveInlineMarkRevealRange(doc: PMNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(pos)
  if (isPosInsideCodeSpecBlock($pos)) return null

  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'heading') return null
  }

  const parent = $pos.parent
  if (!parent.isTextblock || parent.type.name === 'heading') return null

  const hit = findChildAtPos($pos)
  if (!hit) return null

  if (!hit.child.isText) {
    return null
  }

  if (!marksRevealable(hit.child.marks)) return null

  const { from, to } = expandMarkedTextRange(parent, $pos.start($pos.depth), hit)
  return from < to ? { from, to } : null
}

function initialMarkdownForRange(doc: PMNode, schema: Schema, from: number, to: number): string | null {
  try {
    return canonicalMarkdownSemantics.serializeRange(doc, schema, from, to)
  } catch {
    return null
  }
}

const BLOCK_REVEAL_TYPES = new Set(['heading', 'footnoteDef', 'blockMath', 'linkReferenceDef', 'blockquote'])
const PROGRAMMATIC_BLOCK_REVEAL_TYPES = new Set([
  ...BLOCK_REVEAL_TYPES,
  'codeBlock',
  'mermaidBlock',
  'rawBlock',
])

function atxPrefixLength(mdLine: string): number {
  const m = mdLine.match(/^(#{1,6}\s)/u)
  return m ? m[1].length : 0
}

function markdownIndexFromDomPoint(
  contentRoot: HTMLElement,
  clientX: number,
  clientY: number,
  markdown: string,
): number | null {
  const doc = contentRoot.ownerDocument
  let node: Node | null = null
  let offset = 0
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(clientX, clientY)
    if (r) {
      node = r.startContainer
      offset = r.startOffset
    }
  }
  if (!node && 'caretPositionFromPoint' in doc) {
    const cp = (
      doc as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint?.(clientX, clientY)
    if (cp) {
      node = cp.offsetNode
      offset = cp.offset
    }
  }
  if (!node || !contentRoot.contains(node)) return null

  let textBefore = 0
  const walk = (n: Node): boolean => {
    if (n === node) {
      if (n.nodeType === Node.TEXT_NODE) textBefore += offset
      return true
    }
    if (n.nodeType === Node.TEXT_NODE) {
      textBefore += (n as Text).data.length
      return false
    }
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (walk(c)) return true
    }
    return false
  }
  walk(contentRoot)
  return Math.max(0, Math.min(textBefore, markdown.length))
}

function isCodeSpecBlockNode(node: PMNode): boolean {
  return Boolean(node.type.spec.code)
}

/** Double-click at the start of a fence code block can resolve to a position 1–2 chars before the heading above; do not trigger block reveal in that case. */
function shouldSuppressBlockRevealAtPos(
  doc: PMNode,
  pos: number,
  target: HTMLElement | null,
): boolean {
  if (target?.closest?.('[data-luna-code-block-wrap], .pm-code-block-wrap, [data-type="codeBlock"]')) {
    return true
  }
  const clamped = Math.max(1, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(clamped)
  if (isPosInsideCodeSpecBlock($pos)) return true
  const after = $pos.nodeAfter
  const before = $pos.nodeBefore
  if ((after && isCodeSpecBlockNode(after)) || (before && isCodeSpecBlockNode(before))) return true
  return false
}

function resolveRevealableBlockAtPos(doc: PMNode, pos: number): { from: number; to: number; node: PMNode } | null {
  if (shouldSuppressBlockRevealAtPos(doc, pos, null)) return null
  let bestDist = Infinity
  let best: { from: number; to: number; node: PMNode } | null = null
  doc.descendants((node, from) => {
    if (!node.isBlock) return
    if (!BLOCK_REVEAL_TYPES.has(node.type.name)) return
    const to = from + node.nodeSize
    const dist = pos < from ? from - pos : pos > to ? pos - to : 0
    if (dist > 2) return
    if (dist < bestDist) {
      bestDist = dist
      best = { from, to, node }
    }
  })
  if (best) return best
  const $pos = doc.resolve(Math.max(1, Math.min(pos, doc.content.size)))
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (!node.isBlock || !BLOCK_REVEAL_TYPES.has(node.type.name)) continue
    return { from: $pos.before(depth), to: $pos.after(depth), node }
  }
  return null
}

function resolveProgrammaticRevealableBlockAtPos(
  doc: PMNode,
  pos: number,
): { from: number; to: number; node: PMNode } | null {
  let bestDist = Infinity
  let best: { from: number; to: number; node: PMNode } | null = null
  doc.descendants((node, from) => {
    if (!node.isBlock) return
    if (!PROGRAMMATIC_BLOCK_REVEAL_TYPES.has(node.type.name)) return
    const to = from + node.nodeSize
    const dist = pos < from ? from - pos : pos > to ? pos - to : 0
    if (dist > 2) return
    if (dist < bestDist) {
      bestDist = dist
      best = { from, to, node }
    }
  })
  if (best) return best
  const $pos = doc.resolve(Math.max(1, Math.min(pos, doc.content.size)))
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (!node.isBlock || !PROGRAMMATIC_BLOCK_REVEAL_TYPES.has(node.type.name)) continue
    return { from: $pos.before(depth), to: $pos.after(depth), node }
  }
  return null
}

function resolveAtomInlineNodeAtPos(
  doc: PMNode,
  pos: number,
  typeName: string,
): { from: number; to: number; node: PMNode } | null {
  let bestDist = Infinity
  let best: { from: number; to: number; node: PMNode } | null = null
  doc.descendants((node, from) => {
    if (node.type.name !== typeName) return
    const to = from + node.nodeSize
    const dist = pos < from ? from - pos : pos > to ? pos - to : 0
    if (dist > 2) return
    if (dist < bestDist) {
      bestDist = dist
      best = { from, to, node }
    }
  })
  return best
}

function resolveFootnoteRefAtPos(doc: PMNode, pos: number): { from: number; to: number; label: string } | null {
  const hit = resolveAtomInlineNodeAtPos(doc, pos, 'footnoteRef')
  if (!hit) return null
  const label = String(hit.node.attrs.label ?? '').trim()
  if (!label) return null
  return { from: hit.from, to: hit.to, label }
}

function startInlineSourceReveal(view: EditorView, from: number, to: number, md: string, caretOffset?: number): void {
  const offsetInOld = caretOffset ?? to - from
  const newTo = from + md.length
  let tr = view.state.tr.replaceWith(from, to, view.state.schema.text(md))
  tr = tr.setSelection(TextSelection.create(tr.doc, from + Math.max(0, Math.min(offsetInOld, md.length))))
  tr = tr.setMeta(LUNA_INLINE_REVEAL_META, {
    action: 'start',
    payload: { mode: 'inline', from, to: newTo, initialMd: md },
  } satisfies LunaInlineRevealMeta)
  view.dispatch(tr)
}

function resolveHtmlCommentRawInlineAtPos(
  doc: PMNode,
  pos: number,
): { from: number; to: number; md: string } | null {
  let bestDist = Infinity
  let best: { from: number; to: number; md: string } | null = null
  doc.descendants((node, from) => {
    if (node.type.name !== 'rawInline') return
    if (normalizeLunaRawSource(node.attrs.source) !== 'html') return
    if (parseHtmlCommentBody(String(node.attrs.content ?? '')) == null) return
    const to = from + node.nodeSize
    const dist = pos < from ? from - pos : pos > to ? pos - to : 0
    if (dist > 2) return
    const md = String(node.attrs.content ?? '').trim()
    if (!md) return
    if (dist < bestDist) {
      bestDist = dist
      best = { from, to, md }
    }
  })
  return best
}

function startBlockRevealAt(
  view: EditorView,
  block: { from: number; to: number; node: PMNode },
  markdown: string,
  caretOffset: number,
): boolean {
  const { schema } = view.state
  let tr = view.state.tr
  let innerFrom = block.from + 1
  let innerTo = block.to - 1
  let blockTo: number

  if (block.node.isTextblock && block.node.nodeSize >= 2) {
    tr = tr.replaceWith(innerFrom, innerTo, schema.text(markdown))
    const mapped = tr.doc.nodeAt(block.from)
    if (!mapped) return false
    blockTo = block.from + mapped.nodeSize
    innerFrom = block.from + 1
    innerTo = blockTo - 1
  } else {
    const paragraph = schema.nodes.paragraph
    if (!paragraph) return false
    const replacement = markdown ? paragraph.create(null, schema.text(markdown)) : paragraph.create()
    tr = tr.replaceWith(block.from, block.to, replacement)
    blockTo = block.from + replacement.nodeSize
    innerFrom = block.from + 1
    innerTo = blockTo - 1
  }

  const clamped = Math.max(innerFrom, Math.min(innerFrom + Math.max(0, caretOffset), innerTo))
  tr = tr.setSelection(TextSelection.create(tr.doc, clamped))
  tr = tr.setMeta(LUNA_INLINE_REVEAL_META, {
    action: 'start',
    payload: {
      mode: 'block',
      blockFrom: block.from,
      blockTo,
      innerFrom,
      innerTo,
      initialMd: markdown,
      blockType: block.node.type.name,
      blockAttrs: block.node.attrs as Record<string, unknown>,
    },
  } satisfies LunaInlineRevealMeta)
  view.dispatch(tr)
  return true
}

export function startMarkdownBlockSourceReveal(view: EditorView, args: {
  pos: number
  caretOffset?: number
}): boolean {
  const block = resolveProgrammaticRevealableBlockAtPos(view.state.doc, args.pos)
  if (!block) return false
  let markdown: string
  if (block.node.type.name === 'footnoteDef') {
    const label = String(block.node.attrs.label ?? '').trim()
    markdown = footnoteDefMarkdownLine(label, block.node.textContent)
  } else {
    try {
      markdown = canonicalMarkdownSemantics.serializeBlock(block.node, view.state.schema)
    } catch {
      return false
    }
  }
  if (!markdown) return false
  const caret = Math.max(0, Math.min(args.caretOffset ?? markdown.length, markdown.length))
  return startBlockRevealAt(view, block, markdown, caret)
}

function restoreOriginalBlockNode(schema: Schema, reveal: Extract<LunaRevealState, { mode: 'block' }>): PMNode | null {
  const parsed = canonicalMarkdownSemantics.parseFirstBlock(reveal.initialMd, schema)
  if (parsed) return parsed
  if (reveal.blockType === 'blockMath' && schema.nodes.blockMath) {
    const oldLatex = String(reveal.blockAttrs?.latex ?? '').trim()
    return schema.nodes.blockMath.create({ ...(reveal.blockAttrs ?? {}), latex: oldLatex })
  }
  return null
}

function mapRevealThroughMapping(mapping: Mapping, s: LunaRevealState): LunaRevealState | null {
  if (s.mode === 'inline') {
    const from = mapping.map(s.from, -1)
    const to = mapping.map(s.to, 1)
    if (from >= to) return null
    return { ...s, from, to }
  }
  const blockFrom = mapping.map(s.blockFrom, -1)
  const blockTo = mapping.map(s.blockTo, 1)
  const innerFrom = mapping.map(s.innerFrom, -1)
  const innerTo = mapping.map(s.innerTo, 1)
  if (blockFrom >= blockTo || innerFrom > innerTo) return null
  if (innerFrom < blockFrom + 1 || innerTo > blockTo - 1) return null
  return { ...s, blockFrom, blockTo, innerFrom, innerTo }
}

function selectionInsideReveal(sel: Selection, s: LunaRevealState): boolean {
  if (s.mode === 'inline') {
    return sel.from >= s.from && sel.to <= s.to
  }
  return sel.from >= s.innerFrom && sel.to <= s.innerTo
}

function caretInsideReveal(anchor: number, s: LunaRevealState): boolean {
  if (s.mode === 'inline') {
    return anchor >= s.from && anchor <= s.to
  }
  return anchor >= s.innerFrom && anchor <= s.innerTo
}

function revealKey(s: LunaRevealState): string {
  if (s.mode === 'inline') return `i:${s.from}:${s.to}:${s.initialMd}`
  return `b:${s.blockFrom}:${s.blockTo}:${s.innerFrom}:${s.innerTo}:${s.initialMd}`
}

function buildRevealCommitTransaction(state: EditorState, reveal: LunaRevealState): Transaction {
  const schema = state.schema
  let tr = state.tr

  if (reveal.mode === 'inline') {
    const md = state.doc.textBetween(reveal.from, reveal.to, '\n')
    const frag = canonicalMarkdownSemantics.parseInlineFragment(md, schema)
    if (frag) {
      tr = tr.replaceWith(reveal.from, reveal.to, frag)
    }
  } else {
    const md = state.doc.textBetween(reveal.innerFrom, reveal.innerTo, '\n')
    const mdTrimmed = md.trim()
    let replacement: PMNode | null = null

    if (reveal.blockType === 'blockMath') {
      const blockMath = schema.nodes.blockMath
      const oldLatex = String(reveal.blockAttrs?.latex ?? '').trim()
      if (blockMath) {
        if (!mdTrimmed) {
          replacement = blockMath.create({ ...(reveal.blockAttrs ?? {}), latex: oldLatex })
        } else {
          const parsed = canonicalMarkdownSemantics.parseFirstBlock(md, schema)
          if (parsed?.type.name === 'blockMath') {
            const parsedLatex = String(parsed.attrs.latex ?? '').trim()
            const guarded = validateASTBeforeCommit({ type: 'blockMath', next: parsedLatex, previous: oldLatex })
            replacement = blockMath.create({
              ...(reveal.blockAttrs ?? {}),
              ...((parsed.attrs as Record<string, unknown>) ?? {}),
              latex: guarded.value,
            })
          } else {
            const normalized = mdTrimmed.replace(/^\$\$\s*/u, '').replace(/\s*\$\$$/u, '').trim()
            const guarded = validateASTBeforeCommit({ type: 'blockMath', next: normalized, previous: oldLatex })
            replacement = blockMath.create({
              ...(reveal.blockAttrs ?? {}),
              latex: guarded.value,
            })
          }
        }
      }
    } else if (reveal.blockType === 'footnoteDef') {
      const footnoteDef = schema.nodes.footnoteDef
      if (footnoteDef) {
        const parsed = parseFootnoteDefMarkdownLine(md)
        const label = String(parsed?.label ?? reveal.blockAttrs?.label ?? '').trim()
        const bodyMd = (parsed?.body ?? md).trimEnd()
        const guarded = validateASTBeforeCommit({ type: 'footnoteDef', label, content: bodyMd })
        const inline = canonicalMarkdownSemantics.parseInlineFragment(guarded.value, schema)
        replacement = footnoteDef.create(
          { ...(reveal.blockAttrs ?? {}), label },
          inline ?? (guarded.value ? schema.text(guarded.value) : undefined),
        )
      }
    } else if (reveal.blockType === 'linkReferenceDef') {
      if (!mdTrimmed) {
        replacement = restoreOriginalBlockNode(schema, reveal) ?? schema.nodes.paragraph.create()
      } else {
        replacement =
          canonicalMarkdownSemantics.parseFirstBlock(md, schema) ??
          restoreOriginalBlockNode(schema, reveal) ??
          schema.nodes.paragraph.create()
      }
    } else {
      if (!mdTrimmed) {
        replacement = restoreOriginalBlockNode(schema, reveal) ?? schema.nodes.paragraph.create()
      } else {
        replacement =
          canonicalMarkdownSemantics.parseFirstBlock(md, schema) ??
          restoreOriginalBlockNode(schema, reveal) ??
          schema.nodes.paragraph.create()
      }
    }
    replacement ??= restoreOriginalBlockNode(schema, reveal) ?? schema.nodes.paragraph.create()
    tr = tr.replaceWith(reveal.blockFrom, reveal.blockTo, replacement)
    const inner = Math.min(
      Math.max(reveal.blockFrom + 1, tr.selection.$anchor.pos),
      reveal.blockFrom + replacement.nodeSize - 1,
    )
    tr = tr.setSelection(TextSelection.create(tr.doc, inner))
  }

  return tr.setMeta(LUNA_INLINE_REVEAL_META, { action: 'clear' } satisfies LunaInlineRevealMeta)
}

function buildRevealCancelTransaction(state: EditorState, reveal: LunaRevealState): Transaction {
  const schema = state.schema
  let tr = state.tr

  if (reveal.mode === 'inline') {
    const frag = canonicalMarkdownSemantics.parseInlineFragment(reveal.initialMd, schema)
    if (frag && reveal.from < reveal.to && reveal.to <= state.doc.content.size) {
      tr = tr.replaceWith(reveal.from, reveal.to, frag)
    }
  } else {
    const replacement = canonicalMarkdownSemantics.parseFirstBlock(reveal.initialMd, schema)
    if (
      replacement &&
      reveal.blockFrom < reveal.blockTo &&
      reveal.blockTo <= state.doc.content.size
    ) {
      tr = tr.replaceWith(reveal.blockFrom, reveal.blockTo, replacement)
    }
  }

  return tr.setMeta(LUNA_INLINE_REVEAL_META, { action: 'clear' } satisfies LunaInlineRevealMeta)
}

function composeTransactionMapping(transactions: readonly Transaction[]): Mapping {
  const mapping = new MappingClass()
  for (const tr of transactions) {
    if (tr.docChanged) mapping.appendMapping(tr.mapping)
  }
  return mapping
}

function buildRevealRecoveryTransaction(
  state: EditorState,
  reveal: LunaRevealState,
  mapping: Mapping,
): Transaction {
  const mapped = mapRevealThroughMapping(mapping, reveal)
  if (mapped) return buildRevealCommitTransaction(state, mapped)

  if (reveal.mode === 'inline') {
    const from = mapping.map(reveal.from, -1)
    const to = mapping.map(reveal.to, 1)
    if (from < to && to <= state.doc.content.size) {
      return buildRevealCommitTransaction(state, { ...reveal, from, to })
    }
  } else {
    const blockFrom = mapping.map(reveal.blockFrom, -1)
    const blockTo = mapping.map(reveal.blockTo, 1)
    const innerFrom = mapping.map(reveal.innerFrom, -1)
    const innerTo = mapping.map(reveal.innerTo, 1)
    if (
      blockFrom < blockTo &&
      innerFrom <= innerTo &&
      innerFrom >= blockFrom + 1 &&
      innerTo <= blockTo - 1 &&
      blockTo <= state.doc.content.size
    ) {
      return buildRevealCommitTransaction(state, {
        ...reveal,
        blockFrom,
        blockTo,
        innerFrom,
        innerTo,
      })
    }
  }

  return buildRevealCancelTransaction(state, reveal)
}

function performCommit(view: EditorView, reveal: LunaRevealState) {
  view.dispatch(buildRevealCommitTransaction(view.state, reveal))
}

function performCancel(view: EditorView, reveal: LunaRevealState) {
  view.dispatch(buildRevealCancelTransaction(view.state, reveal))
}

export const LunaMarkdownSourceReveal = Extension.create({
  name: 'lunaMarkdownSourceReveal',

  addStorage() {
    return { active: false as boolean }
  },

  addProseMirrorPlugins() {
    const storage = this.storage

    return [
      new Plugin<LunaRevealState | null>({
        key: lunaInlineRevealPluginKey,

        state: {
          init: () => null,
          apply(tr, prev, _oldState, _newState) {
            const w = tr.getMeta(LUNA_INLINE_REVEAL_META) as LunaInlineRevealMeta | undefined
            if (w?.action === 'clear') return null
            if (w?.action === 'start') return w.payload
            if (!prev) return null
            if (tr.docChanged) return mapRevealThroughMapping(tr.mapping, prev)
            return prev
          },
        },

        appendTransaction(transactions, oldState, newState) {
          const before = lunaInlineRevealPluginKey.getState(oldState)
          if (!before) return null
          if (lunaInlineRevealPluginKey.getState(newState)) return null

          const explicit = transactions.some((tr) => {
            const m = tr.getMeta(LUNA_INLINE_REVEAL_META) as LunaInlineRevealMeta | undefined
            return m?.action === 'clear' || m?.action === 'start'
          })
          if (explicit) return null

          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) return null

          return buildRevealRecoveryTransaction(
            newState,
            before,
            composeTransactionMapping(transactions),
          )
        },

        view: () => ({
          update(v, prevState) {
            storage.active = Boolean(lunaInlineRevealPluginKey.getState(v.state))
            if (v.composing) return
            const r = lunaInlineRevealPluginKey.getState(v.state)
            if (!r) return
            if (v.state.selection.eq(prevState.selection)) return
            if (selectionInsideReveal(v.state.selection, r)) return
            const key = revealKey(r)
            queueMicrotask(() => {
              const still = lunaInlineRevealPluginKey.getState(v.state)
              if (!still || revealKey(still) !== key) return
              if (selectionInsideReveal(v.state.selection, still)) return
              performCommit(v, still)
            })
          },
        }),

        props: {
          handleDOMEvents: {
            mousedown(view, evt) {
              if (view.composing) return false
              const reveal = lunaInlineRevealPluginKey.getState(view.state)
              if (!reveal) return false
              const t = evt.target as HTMLElement | null
              if (t?.closest?.('.luna-code-lang-palette') || t?.closest?.('.workspace-menu-pop') || t?.closest?.('.luna-emoji-picker')) return false

              const coords = view.posAtCoords({ left: evt.clientX, top: evt.clientY })
              const p = coords?.pos
              if (p == null) return false

              if (caretInsideReveal(p, reveal)) return false

              performCommit(view, reveal)
              return false
            },

            dblclick(view, event) {
              if (view.composing) return false
              const reveal = lunaInlineRevealPluginKey.getState(view.state)
              if (reveal) {
                performCommit(view, reveal)
              }

              const target = event.target as HTMLElement | null
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              const pos = coords?.pos
              if (pos == null) return false
              if (shouldSuppressBlockRevealAtPos(view.state.doc, pos, target)) return false

              const block = resolveRevealableBlockAtPos(view.state.doc, pos)
              if (block) {
                let markdown: string
                if (block.node.type.name === 'footnoteDef') {
                  const label = String(block.node.attrs.label ?? '').trim()
                  markdown = footnoteDefMarkdownLine(label, block.node.textContent)
                } else {
                  try {
                    markdown = canonicalMarkdownSemantics.serializeBlock(block.node, view.state.schema)
                  } catch {
                    return false
                  }
                }
                if (!markdown) return false
                let caret = markdown.length
                if (block.node.type.name === 'heading') {
                  const root = target?.closest('.pm-heading-read')?.querySelector('.pm-heading-content')
                  if (root instanceof HTMLElement) {
                    const idx = markdownIndexFromDomPoint(root, event.clientX, event.clientY, markdown)
                    if (idx != null) {
                      const pre = atxPrefixLength(markdown)
                      const body = Math.max(0, Math.min(idx, Math.max(0, markdown.length - pre)))
                      caret = Math.min(markdown.length, pre + body)
                    }
                  }
                } else if (block.node.type.name === 'footnoteDef') {
                  const label = String(block.node.attrs.label ?? '').trim()
                  const prefixLen = footnoteDefMarkdownLine(label, '').length
                  const root = target?.closest('.pm-footnote-def-wrap')?.querySelector('.pm-footnote-def-body')
                  if (root instanceof HTMLElement) {
                    const idx = markdownIndexFromDomPoint(root, event.clientX, event.clientY, block.node.textContent)
                    if (idx != null) caret = Math.min(markdown.length, prefixLen + idx)
                  } else if (target?.closest('.pm-footnote-def-marker')) {
                    caret = Math.min(markdown.length, prefixLen)
                  }
                } else if (block.node.type.name === 'linkReferenceDef') {
                  const root = target?.closest('.pm-link-reference-def')
                  if (root instanceof HTMLElement) {
                    const idx = markdownIndexFromDomPoint(root, event.clientX, event.clientY, markdown)
                    if (idx != null) caret = Math.min(markdown.length, idx)
                  }
                }
                event.preventDefault()
                event.stopPropagation()
                const ok = startBlockRevealAt(view, block, markdown, caret)
                if (!ok) return false
                queueMicrotask(() => {
                  storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
                })
                return true
              }

              const inlineMathHit = resolveAtomInlineNodeAtPos(view.state.doc, pos, 'inlineMath')
              if (inlineMathHit) {
                const latex = String(inlineMathHit.node.attrs.latex ?? '').trim()
                if (latex) {
                  event.preventDefault()
                  event.stopPropagation()
                  startInlineSourceReveal(
                    view,
                    inlineMathHit.from,
                    inlineMathHit.to,
                    `$${latex}$`,
                    Math.min(latex.length + 1, pos - inlineMathHit.from + 1),
                  )
                  queueMicrotask(() => {
                    storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
                  })
                  return true
                }
              }

              const footnoteRef = resolveFootnoteRefAtPos(view.state.doc, pos)
              if (footnoteRef) {
                const md = `[^${footnoteRef.label}]`
                event.preventDefault()
                event.stopPropagation()
                startInlineSourceReveal(view, footnoteRef.from, footnoteRef.to, md)
                queueMicrotask(() => {
                  storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
                })
                return true
              }

              const htmlCommentFromDom = target?.closest('[data-type="html-comment"]')
              if (htmlCommentFromDom instanceof Element) {
                const hit = resolveHtmlCommentFromDom(view, htmlCommentFromDom)
                if (hit) {
                  event.preventDefault()
                  event.stopPropagation()
                  startInlineMarkdownReveal(view, hit.from, hit.to, hit.md)
                  queueMicrotask(() => {
                    storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
                  })
                  return true
                }
              }

              const htmlComment = resolveHtmlCommentRawInlineAtPos(view.state.doc, pos)
              if (htmlComment) {
                event.preventDefault()
                event.stopPropagation()
                startInlineMarkdownReveal(view, htmlComment.from, htmlComment.to, htmlComment.md)
                queueMicrotask(() => {
                  storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
                })
                return true
              }

              const range = resolveInlineMarkRevealRange(view.state.doc, pos)
              if (!range) return false

              const md = initialMarkdownForRange(view.state.doc, view.state.schema, range.from, range.to)
              if (!md) return false

              const oldLen = range.to - range.from
              const offsetInOld = Math.max(0, Math.min(pos - range.from, oldLen))
              const offsetInNew =
                oldLen > 0 ? Math.min(md.length, Math.round((offsetInOld / oldLen) * md.length)) : md.length

              event.preventDefault()
              event.stopPropagation()

              const newTo = range.from + md.length
              let tr = view.state.tr.replaceWith(range.from, range.to, view.state.schema.text(md))
              tr = tr.setSelection(TextSelection.create(tr.doc, range.from + offsetInNew))
              tr = tr.setMeta(LUNA_INLINE_REVEAL_META, {
                action: 'start',
                payload: { mode: 'inline', from: range.from, to: newTo, initialMd: md },
              } satisfies LunaInlineRevealMeta)
              view.dispatch(tr)

              queueMicrotask(() => {
                storage.active = Boolean(lunaInlineRevealPluginKey.getState(view.state))
              })

              return true
            },
          },

          handleKeyDown(view, event) {
            if (event.key !== 'Escape') return false
            const reveal = lunaInlineRevealPluginKey.getState(view.state)
            if (!reveal) return false
            event.preventDefault()
            performCancel(view, reveal)
            return true
          },
        },
      }),
    ]
  },
})
