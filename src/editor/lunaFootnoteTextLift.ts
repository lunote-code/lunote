import { Fragment } from 'prosemirror-model'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

import { isPosInsideCodeSpecBlock } from './lunaCodeContext'

const PLAIN_FOOTNOTE_REF = /\[\^([^\]\s][^\]]*)\]/gu

/** Promote the plain text `[^label]` in the paragraph to a footnoteRef node to avoid being esc'd into `\[^label\]` during serialization*/
export function liftPlainTextFootnoteRefs(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const refType = schema.nodes.footnoteRef
  if (!refType) return doc

  const hits: { pos: number; node: ProseMirrorNode }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (node.marks.some((m) => m.type.name === 'code')) return
    if (isPosInsideCodeSpecBlock(doc.resolve(pos))) return
    if (!PLAIN_FOOTNOTE_REF.test(node.text)) return
    hits.push({ pos, node })
  })

  if (hits.length === 0) return doc

  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { pos, node } = hits[i]!
    const text = node.text ?? ''
    const parts: ProseMirrorNode[] = []
    let last = 0
    PLAIN_FOOTNOTE_REF.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = PLAIN_FOOTNOTE_REF.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(schema.text(text.slice(last, match.index), node.marks))
      }
      parts.push(refType.create({ label: match[1]!, index: 0, preview: '' }))
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
