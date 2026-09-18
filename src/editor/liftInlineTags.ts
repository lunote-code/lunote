import { Fragment } from 'prosemirror-model'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

import { isPosInsideCodeSpecBlock } from './lunaCodeContext'

const PLAIN_INLINE_TAG = /(?:^|(?<=\s))#([a-zA-Z][a-zA-Z0-9_/-]*)/gu

/** Promote plain `#tag` text to inlineTag atoms. */
export function liftPlainTextInlineTags(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const tagType = schema.nodes.inlineTag
  if (!tagType) return doc

  const hits: { pos: number; node: ProseMirrorNode }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (node.marks.some((m) => m.type.name === 'code')) return
    if (isPosInsideCodeSpecBlock(doc.resolve(pos))) return
    PLAIN_INLINE_TAG.lastIndex = 0
    if (!PLAIN_INLINE_TAG.test(node.text)) return
    hits.push({ pos, node })
  })
  if (hits.length === 0) return doc

  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { pos, node } = hits[i]!
    const text = node.text ?? ''
    const parts: ProseMirrorNode[] = []
    let last = 0
    PLAIN_INLINE_TAG.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = PLAIN_INLINE_TAG.exec(text)) !== null) {
      const tag = match[1]!
      if (match.index > last) {
        parts.push(schema.text(text.slice(last, match.index), node.marks))
      }
      parts.push(tagType.create({ tag, raw: `#${tag}` }))
      last = match.index + match[0].length
    }
    if (last < text.length) {
      parts.push(schema.text(text.slice(last), node.marks))
    }
    if (parts.length === 0) continue
    tr.replaceWith(pos, pos + node.nodeSize, Fragment.from(parts))
  }
  return tr.doc
}
