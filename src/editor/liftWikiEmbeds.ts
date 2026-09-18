import { Fragment } from 'prosemirror-model'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'

import { isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { parseWikiEmbedTokenAt, isImageEmbedTarget } from './wikiEmbedParse'
import { resolveMarkdownMediaSrc, buildMediaSourceResolveOptions } from '../export/mediaSources'

const WIKI_EMBED_IN_TEXT = /!\[\[[^\]]+\]\]/gu

type LiftWikiEmbedOptions = {
  rootDir?: string | null
  activePath?: string | null
}

function wikiEmbedAttrsFromParsed(parsed: NonNullable<ReturnType<typeof parseWikiEmbedTokenAt>>) {
  return {
    raw: parsed.raw,
    docKey: parsed.docKey,
    heading: parsed.heading ?? null,
    blockId: parsed.blockId ?? null,
    alias: parsed.alias ?? null,
  }
}

/** Promote a lone `![[note]]` paragraph (text or inline embed) to a block wikiEmbed. */
export function liftStandaloneWikiEmbedParagraphs(doc: ProseMirrorNode, schema: Schema): ProseMirrorNode {
  const blockType = schema.nodes.wikiEmbed
  if (!blockType) return doc

  const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = []
  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return
    const trimmed = node.textContent.trim()
    const parsed = parseWikiEmbedTokenAt(trimmed, 0)
    if (parsed && parsed.raw === trimmed) {
      hits.push({ pos: offset, size: node.nodeSize, attrs: wikiEmbedAttrsFromParsed(parsed) })
      return
    }
    if (node.childCount === 1 && node.firstChild?.type.name === 'wikiEmbedInline') {
      hits.push({ pos: offset, size: node.nodeSize, attrs: { ...node.firstChild.attrs } })
    }
  })

  if (hits.length === 0) return doc

  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i]!
    tr.replaceWith(hit.pos, hit.pos + hit.size, blockType.create(hit.attrs))
  }
  return tr.doc
}

/** Promote plain `![[...]]` text to wiki embed nodes; image targets become image nodes. */
export function liftPlainTextWikiEmbeds(
  doc: ProseMirrorNode,
  schema: Schema,
  options: LiftWikiEmbedOptions = {},
): ProseMirrorNode {
  const blockType = schema.nodes.wikiEmbed
  const inlineType = schema.nodes.wikiEmbedInline
  const imageType = schema.nodes.image
  if (!blockType && !inlineType) return doc

  const hits: { pos: number; node: ProseMirrorNode }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (node.marks.some((m) => m.type.name === 'code')) return
    if (isPosInsideCodeSpecBlock(doc.resolve(pos))) return
    WIKI_EMBED_IN_TEXT.lastIndex = 0
    if (!WIKI_EMBED_IN_TEXT.test(node.text)) return
    hits.push({ pos, node })
  })

  if (hits.length === 0) return doc

  const mediaOpts = buildMediaSourceResolveOptions(options.rootDir ?? null)
  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { pos, node } = hits[i]!
    const text = node.text ?? ''
    const parts: ProseMirrorNode[] = []
    let last = 0
    WIKI_EMBED_IN_TEXT.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKI_EMBED_IN_TEXT.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(schema.text(text.slice(last, match.index), node.marks))
      }
      const parsed = parseWikiEmbedTokenAt(match[0], 0)
      if (parsed && imageType && isImageEmbedTarget(parsed.docKey)) {
        const src = resolveMarkdownMediaSrc(parsed.docKey, options.activePath ?? null, mediaOpts)
        parts.push(
          imageType.create({
            src,
            alt: parsed.alias ?? parsed.docKey,
            title: null,
          }),
        )
      } else if (parsed && inlineType) {
        parts.push(
          inlineType.create(wikiEmbedAttrsFromParsed(parsed)),
        )
      } else if (match[0]) {
        parts.push(schema.text(match[0], node.marks))
      }
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

/** Convert wiki embed nodes that point at images into `image` nodes. */
export function promoteImageWikiEmbeds(
  doc: ProseMirrorNode,
  schema: Schema,
  options: LiftWikiEmbedOptions = {},
): ProseMirrorNode {
  const imageType = schema.nodes.image
  if (!imageType) return doc

  const mediaOpts = buildMediaSourceResolveOptions(options.rootDir ?? null)
  const hits: { pos: number; node: ProseMirrorNode }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'wikiEmbed' && node.type.name !== 'wikiEmbedInline') return
    const docKey = String(node.attrs.docKey ?? '')
    if (!isImageEmbedTarget(docKey)) return
    hits.push({ pos, node })
  })
  if (hits.length === 0) return doc

  const tr = new Transform(doc)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { pos, node } = hits[i]!
    const docKey = String(node.attrs.docKey ?? '')
    const src = resolveMarkdownMediaSrc(docKey, options.activePath ?? null, mediaOpts)
    tr.replaceWith(
      pos,
      pos + node.nodeSize,
      imageType.create({
        src,
        alt: String(node.attrs.alias ?? docKey),
        title: null,
      }),
    )
  }
  return tr.doc
}
