import { Fragment, type Mark, type Node as PMNode, type Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

import { isSpanCloseTag, parseColorFromSpanOpenTag, spanStyleColorTag } from './lunaTextColor'
export { spanStyleColorTag }

function isUnderlineOpenTag(content: string): boolean {
  return /^<u(?:\s[^>]*)?>\s*$/iu.test(String(content ?? '').trim())
}

function isUnderlineCloseTag(content: string): boolean {
  return /^<\/u\s*>\s*$/iu.test(String(content ?? '').trim())
}

function applyMarkToInlineNode(node: PMNode, mark: Mark, markName: string): PMNode {
  if (node.isText) {
    const without = node.marks.filter((m) => m.type.name !== markName)
    return node.mark([...without, mark])
  }
  return node
}

type LiftRule = {
  markName: string
  matchOpen: (content: string) => boolean
  matchClose: (content: string) => boolean
  createMark: (openContent: string) => Mark | null
}

function buildLiftRules(schema: Schema): LiftRule[] {
  const rules: LiftRule[] = []
  const textColor = schema.marks.textColor
  if (textColor) {
    rules.push({
      markName: 'textColor',
      matchOpen: (c) => parseColorFromSpanOpenTag(c) != null,
      matchClose: isSpanCloseTag,
      createMark: (open) => {
        const color = parseColorFromSpanOpenTag(open)
        return color ? textColor.create({ color }) : null
      },
    })
  }
  const underline = schema.marks.underline
  if (underline) {
    rules.push({
      markName: 'underline',
      matchOpen: isUnderlineOpenTag,
      matchClose: isUnderlineCloseTag,
      createMark: () => underline.create(),
    })
  }
  return rules
}

function liftMarksInFragment(fragment: Fragment, rules: LiftRule[]): Fragment | null {
  const nodes = fragment.content
  if (nodes.length === 0 || rules.length === 0) return null

  const out: PMNode[] = []
  let changed = false
  let i = 0

  while (i < nodes.length) {
    const node = nodes[i]!
    if (node.type.name === 'rawInline' && String(node.attrs.source ?? '') === 'html') {
      const openContent = String(node.attrs.content ?? '')
      const rule = rules.find((r) => r.matchOpen(openContent))
      if (rule) {
        const mark = rule.createMark(openContent)
        if (mark) {
          const inner: PMNode[] = []
          let j = i + 1
          let closed = false
          while (j < nodes.length) {
            const innerNode = nodes[j]!
            if (
              innerNode.type.name === 'rawInline' &&
              String(innerNode.attrs.source ?? '') === 'html' &&
              rule.matchClose(String(innerNode.attrs.content ?? ''))
            ) {
              closed = true
              j += 1
              break
            }
            inner.push(innerNode)
            j += 1
          }
          if (closed && inner.length > 0) {
            changed = true
            for (const innerNode of inner) {
              out.push(applyMarkToInlineNode(innerNode, mark, rule.markName))
            }
            i = j
            continue
          }
        }
      }
    }
    out.push(node)
    i += 1
  }

  return changed ? Fragment.fromArray(out) : null
}

function liftMarksInNode(node: PMNode, rules: LiftRule[]): PMNode | null {
  if (node.isTextblock) {
    const next = liftMarksInFragment(node.content, rules)
    return next ? node.copy(next) : null
  }
  if (!node.content.size) return null
  const children: PMNode[] = []
  let changed = false
  node.forEach((child) => {
    const lifted = liftMarksInNode(child, rules)
    if (lifted) {
      changed = true
      children.push(lifted)
    } else {
      children.push(child)
    }
  })
  return changed ? node.copy(Fragment.fromArray(children)) : null
}

/** Promote the inline HTML (span color, u, etc.) separated by markdown-it to the corresponding mark*/
export function liftInlineHtmlFormattingMarks(doc: PMNode, schema: Schema): PMNode {
  const rules = buildLiftRules(schema)
  if (rules.length === 0) return doc
  const lifted = liftMarksInNode(doc, rules)
  return lifted ?? doc
}

const LIFT_FIXPOINT_MAX = 8

/** Nested/continuous rawInline HTML requires multiple passes of promotion (single pass cannot handle `<u><span>…`, etc.)*/
export function liftInlineHtmlFormattingMarksIterated(doc: PMNode, schema: Schema): PMNode {
  let current = doc
  for (let i = 0; i < LIFT_FIXPOINT_MAX; i += 1) {
    const next = liftInlineHtmlFormattingMarks(current, schema)
    if (next.eq(current)) return current
    current = next
  }
  return current
}

export function liftInlineHtmlTextColor(doc: PMNode, schema: Schema): PMNode {
  return liftInlineHtmlFormattingMarks(doc, schema)
}

export function buildLiftInlineHtmlTextColorTransform(doc: PMNode, schema: Schema): Transform | null {
  const next = liftInlineHtmlFormattingMarks(doc, schema)
  if (next.eq(doc)) return null
  return new Transform(doc).replaceWith(0, doc.content.size, next.content)
}
