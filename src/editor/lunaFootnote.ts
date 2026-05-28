import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { FootnoteDefView } from '../components/nodes/FootnoteDefView'
import { FootnoteRefView } from '../components/nodes/FootnoteRefView'

/** Inline footnote citations: rendered as [¹] (Typora/Obsidian style), source remains as [^label]*/
export const LunaFootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: { default: '' },
      index: { default: 0 },
      preview: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote-label]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const index = Number(node.attrs.index ?? 0)
    const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹'
    const display = index > 0 && index < 10 ? digits[index]! : index > 0 ? String(index) : '?'
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-footnote-ref',
        'data-footnote-label': String(node.attrs.label ?? ''),
        title: String(node.attrs.preview ?? '') || undefined,
      }),
      `[${display}]`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteRefView)
  },
})

/** Footnote definition block `[^label]: …`*/
export const LunaFootnoteDef = Node.create({
  name: 'footnoteDef',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      label: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-footnote-def]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? '')
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'pm-footnote-def-wrap',
        'data-footnote-def': label,
        id: `fn-${label}`,
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteDefView)
  },
})
