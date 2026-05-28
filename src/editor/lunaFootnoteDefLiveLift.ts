import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { liftFootnoteDefParagraphs } from './lunaFootnoteDefLift'

/** Promote `[^label]body` lines typed in visual mode to footnoteDef blocks. */
export const LunaFootnoteDefLiveLift = Extension.create({
  name: 'lunaFootnoteDefLiveLift',

  priority: 50,

  addProseMirrorPlugins() {
    const key = new PluginKey('lunaFootnoteDefLiveLift')
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
          if (!newState.schema.nodes.footnoteDef || !newState.schema.nodes.footnoteRef) return null
          const nextDoc = liftFootnoteDefParagraphs(newState.doc, newState.schema)
          if (nextDoc.eq(newState.doc)) return null
          const tr = newState.tr.replaceWith(0, newState.doc.content.size, nextDoc.content)
          try {
            tr.setSelection(newState.selection.map(tr.doc, tr.mapping))
          } catch {
            // structure changed significantly
          }
          return tr
        },
      }),
    ]
  },
})
