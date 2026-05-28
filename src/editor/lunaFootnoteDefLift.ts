import { Fragment, type Node as ProseMirrorNode, type Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

/** Paragraph begins with footnoteRef and body text immediately after `]` (missing `: `). */
export function isFootnoteDefLikeParagraph(node: ProseMirrorNode, schema: Schema): boolean {
  const refType = schema.nodes.footnoteRef
  if (node.type.name !== 'paragraph' || !refType || node.childCount < 1) return false
  if (node.child(0).type !== refType) return false
  if (node.childCount === 1) return true
  const second = node.child(1)
  if (!second.isText) return false
  return !(second.text ?? '').startsWith(' ')
}

/** Promote `[^label]body` paragraphs (missing colon) to footnoteDef blocks. */
export function liftFootnoteDefParagraphs(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const refType = schema.nodes.footnoteRef
  const defType = schema.nodes.footnoteDef
  if (!refType || !defType) return doc

  const hits: { pos: number; node: ProseMirrorNode; label: string; body: Fragment }[] = []
  doc.descendants((node, pos) => {
    if (!isFootnoteDefLikeParagraph(node, schema)) return
    const label = String(node.child(0).attrs.label ?? '').trim()
    if (!label) return
    const bodyNodes: ProseMirrorNode[] = []
    for (let i = 1; i < node.childCount; i += 1) {
      bodyNodes.push(node.child(i))
    }
    hits.push({
      pos,
      node,
      label,
      body: bodyNodes.length > 0 ? Fragment.from(bodyNodes) : Fragment.empty,
    })
  })

  if (hits.length === 0) return doc

  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i]!
    tr.replaceWith(hit.pos, hit.pos + hit.node.nodeSize, defType.create({ label: hit.label }, hit.body))
  }
  return tr.doc
}

export function footnoteDefMarkdownLine(label: string, body: string): string {
  const trimmedLabel = label.trim()
  const trimmedBody = body.trimEnd()
  return trimmedBody ? `[^${trimmedLabel}]: ${trimmedBody}` : `[^${trimmedLabel}]: `
}

export function parseFootnoteDefMarkdownLine(md: string): { label: string; body: string } | null {
  const trimmed = md.trimEnd()
  const withColon = trimmed.match(/^\[\^([^\]\s][^\]]*)\]:\s?(.*)$/su)
  if (withColon) {
    return { label: withColon[1]!.trim(), body: withColon[2] ?? '' }
  }
  const abutted = trimmed.match(/^\[\^([^\]\s][^\]]*)\]([^\s].*)$/su)
  if (abutted) {
    return { label: abutted[1]!.trim(), body: abutted[2] ?? '' }
  }
  return null
}
