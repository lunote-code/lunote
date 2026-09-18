import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { WikiEmbedView } from '../components/nodes/WikiEmbedView'
import { docKeyFromWikiTarget } from './knowledgeRuntime/wikiLinkParser'

export type WikiEmbedAttrs = {
  raw: string
  docKey: string
  heading?: string | null
  blockId?: string | null
  alias?: string | null
}

export function wikiEmbedAttrsFromMeta(meta?: Record<string, string>, raw?: string): WikiEmbedAttrs {
  const docKeyRaw = String(meta?.docKey ?? '').trim()
  return {
    raw: String(meta?.raw ?? raw ?? '').trim(),
    docKey: docKeyRaw ? docKeyFromWikiTarget(docKeyRaw) : '',
    heading: meta?.heading?.trim() || null,
    blockId: meta?.blockId?.trim() || null,
    alias: meta?.alias?.trim() || null,
  }
}

/** Block-level `![[note]]` transclusion. */
export const LunaWikiEmbed = Node.create({
  name: 'wikiEmbed',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      raw: { default: '' },
      docKey: { default: '' },
      heading: { default: null },
      blockId: { default: null },
      alias: { default: null },
      collapsed: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-wiki-embed]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-wiki-embed',
        'data-wiki-embed': '1',
        'data-doc-key': String(attrs.docKey ?? ''),
        'data-raw': String(attrs.raw ?? ''),
        'data-heading': attrs.heading ? String(attrs.heading) : undefined,
        'data-block-id': attrs.blockId ? String(attrs.blockId) : undefined,
      }),
      String(attrs.raw ?? ''),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiEmbedView, {
      selectedOnTextSelection: false,
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return !!target.closest(
          '.pm-wiki-embed-chrome, [data-wiki-embed-surface="1"], .pm-wiki-embed-image-wrap',
        )
      },
      ignoreMutation: ({ mutation }) => {
        const target = mutation.target
        if (!(target instanceof Node)) return false
        const el = target instanceof Element ? target : target.parentElement
        return !!el?.closest('[data-wiki-embed-surface="1"]')
      },
    })
  },
})

/** Inline `![[note]]` inside a paragraph (rendered as block widget). */
export const LunaWikiEmbedInline = Node.create({
  name: 'wikiEmbedInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      raw: { default: '' },
      docKey: { default: '' },
      heading: { default: null },
      blockId: { default: null },
      alias: { default: null },
      collapsed: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-embed-inline]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-wiki-embed-inline-host',
        'data-wiki-embed-inline': '1',
        'data-doc-key': String(node.attrs.docKey ?? ''),
        'data-raw': String(node.attrs.raw ?? ''),
      }),
      ['span', { class: 'pm-wiki-embed-inline' }, String(node.attrs.raw ?? '')],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiEmbedView, {
      selectedOnTextSelection: false,
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return !!target.closest(
          '.pm-wiki-embed-chrome, [data-wiki-embed-surface="1"], .pm-wiki-embed-image-wrap',
        )
      },
      ignoreMutation: ({ mutation }) => {
        const target = mutation.target
        if (!(target instanceof Node)) return false
        const el = target instanceof Element ? target : target.parentElement
        return !!el?.closest('[data-wiki-embed-surface="1"]')
      },
    })
  },
})
