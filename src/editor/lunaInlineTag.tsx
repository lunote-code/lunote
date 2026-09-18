import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { InlineTagView } from '../components/nodes/InlineTagView'

/** Obsidian-style inline `#tag` chip. */
export const LunaInlineTag = Node.create({
  name: 'inlineTag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      tag: { default: '' },
      raw: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-tag]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const tag = String(node.attrs.tag ?? '')
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-inline-tag',
        'data-inline-tag': tag,
      }),
      `#${tag}`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineTagView)
  },
})
