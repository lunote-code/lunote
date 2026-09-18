import { Transform } from 'prosemirror-transform'
import type { Node as PMNode, Schema } from 'prosemirror-model'

import { normalizeLunaRawSource } from './lunaRawBlock'

export type ParsedStandaloneHtmlImg = {
  src: string
  alt: string
  title: string | null
}

const STANDALONE_IMG_TAG_RE = /^<img\b[\s\S]*\/?>$/iu

export function parseStandaloneHtmlImg(content: string): ParsedStandaloneHtmlImg | null {
  const trimmed = content.trim()
  if (!STANDALONE_IMG_TAG_RE.test(trimmed)) return null

  if (typeof document !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    const img = doc.body.querySelector('img')
    if (!img || doc.body.children.length !== 1 || doc.body.firstElementChild?.tagName !== 'IMG') {
      return null
    }
    const src = img.getAttribute('src')?.trim()
    if (!src) return null
    return {
      src,
      alt: img.getAttribute('alt') ?? '',
      title: img.getAttribute('title'),
    }
  }

  const srcMatch = trimmed.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu)
  const src = (srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3])?.trim()
  if (!src) return null
  const altMatch = trimmed.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu)
  const titleMatch = trimmed.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu)
  return {
    src,
    alt: altMatch?.[1] ?? altMatch?.[2] ?? altMatch?.[3] ?? '',
    title: titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? null,
  }
}

/** Promote markdown-it `html_inline` `<img>` atoms to `image` nodes (table cells, etc.). */
export function liftHtmlInlineImages(doc: PMNode, schema: Schema): PMNode {
  const imageType = schema.nodes.image
  if (!imageType) return doc

  type Hit = { pos: number; attrs: ParsedStandaloneHtmlImg }
  const hits: Hit[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'rawInline') return
    if (normalizeLunaRawSource(node.attrs.source) !== 'html') return
    const parsed = parseStandaloneHtmlImg(String(node.attrs.content ?? ''))
    if (!parsed) return
    hits.push({ pos, attrs: parsed })
  })

  if (hits.length === 0) return doc

  hits.sort((a, b) => b.pos - a.pos)
  let tr = new Transform(doc)
  for (const { pos, attrs } of hits) {
    const node = tr.doc.nodeAt(pos)
    if (!node || node.type.name !== 'rawInline') continue
    const next = imageType.create({
      src: attrs.src,
      alt: attrs.alt,
      title: attrs.title,
    })
    tr = tr.replaceWith(pos, pos + node.nodeSize, next)
  }
  return tr.doc
}
