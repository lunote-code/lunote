import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { liftInlineHtmlFormattingMarksIterated } from './lunaInlineHtmlMarkLift'

/**
 * Pasting/inputting HTML fragments in visual mode will not go through `parseMarkdownToDoc`;
 * Promote split rawInline + text to textColor / underline mark before transaction commit.
 */
export const LunaInlineHtmlMarkLiveLift = Extension.create({
  name: 'lunaInlineHtmlMarkLiveLift',

  priority: 50,

  addProseMirrorPlugins() {
    const key = new PluginKey('lunaInlineHtmlMarkLiveLift')
    let viewRef: EditorView | null = null
    return [
      new Plugin({
        key,
        view(view) {
          viewRef = view
          return {}
        },
        appendTransaction(_trs, _oldState, newState) {
          if (viewRef?.composing) return null
          const schema = newState.schema
          if (!schema.marks.textColor && !schema.marks.underline) return null
          const nextDoc = liftInlineHtmlFormattingMarksIterated(newState.doc, schema)
          if (nextDoc.eq(newState.doc)) return null
          const tr = newState.tr.replaceWith(0, newState.doc.content.size, nextDoc.content)
          try {
            const mapped = newState.selection.map(tr.doc, tr.mapping)
            tr.setSelection(mapped)
          } catch {
            /*When the structure changes significantly, map may fail and the document transformation is still applied.*/
          }
          return tr
        },
      }),
    ]
  },
})
