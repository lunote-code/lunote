import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { liftMarkdownTaskLists } from './markdownStructuralTransforms'

/**
 * When typing `- [ ] text` using the list input rule in WYSIWYG, the document is still a bulletList and will not go through `parseMarkdownToDoc`.
 * The checkbox will not appear. This plug-in promotes the bullet/ordered list of "the entire table is a GFM task item" to a taskList before the transaction is submitted.
 */
export const LunaTaskListLiveLift = Extension.create({
  name: 'lunaTaskListLiveLift',

  priority: 50,

  addProseMirrorPlugins() {
    const key = new PluginKey('lunaTaskListLiveLift')
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
          if (!newState.schema.nodes.taskList || !newState.schema.nodes.taskItem) return null
          const nextDoc = liftMarkdownTaskLists(newState.doc, newState.schema)
          if (nextDoc.eq(newState.doc)) return null
          const tr = newState.tr.replaceWith(0, newState.doc.content.size, nextDoc.content)
          try {
            const mapped = newState.selection.map(tr.doc, tr.mapping)
            tr.setSelection(mapped)
          } catch {
            //When the structure changes significantly, map may fail and the document transformation is still applied.
          }
          return tr
        },
      }),
    ]
  },
})
