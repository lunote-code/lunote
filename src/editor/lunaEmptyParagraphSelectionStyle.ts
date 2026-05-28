import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const PLUGIN_KEY = new PluginKey('lunaEmptyParagraphSelectionStyle')

export const EMPTY_PARA_IN_SELECTION_CLASS = 'pm-empty-para-in-selection'

function isVisuallyEmptyParagraph(node: PMNode): boolean {
  if (node.type.name !== 'paragraph') return false
  if (node.content.size === 0) return true
  if (node.childCount === 1) {
    const child = node.firstChild
    if (child?.type.name === 'hardBreak') return true
  }
  return false
}

function buildEmptyParagraphSelectionDecorations(doc: PMNode, from: number, to: number): DecorationSet {
  if (from === to) return DecorationSet.empty
  const decorations: Decoration[] = []
  doc.nodesBetween(from, to, (node, pos) => {
    if (!isVisuallyEmptyParagraph(node)) return
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, { class: EMPTY_PARA_IN_SELECTION_CLASS }),
    )
  })
  return decorations.length ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

export const LunaEmptyParagraphSelectionStyle = Extension.create({
  name: 'lunaEmptyParagraphSelectionStyle',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          decorations(state) {
            const { doc, selection } = state
            return buildEmptyParagraphSelectionDecorations(doc, selection.from, selection.to)
          },
        },
      }),
    ]
  },
})
