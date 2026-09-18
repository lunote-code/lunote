import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { liftPlainTextWikiEmbeds, liftStandaloneWikiEmbedParagraphs } from './liftWikiEmbeds'

/** Promote `![[note]]` typed in visual mode to wiki embed nodes without waiting for re-parse. */
export const LunaWikiEmbedLiveLift = Extension.create({
  name: 'lunaWikiEmbedLiveLift',

  priority: 50,

  addProseMirrorPlugins() {
    const key = new PluginKey('lunaWikiEmbedLiveLift')
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
          if (!schema.nodes.wikiEmbed && !schema.nodes.wikiEmbedInline) return null

          let nextDoc = liftPlainTextWikiEmbeds(newState.doc, schema)
          nextDoc = liftStandaloneWikiEmbedParagraphs(nextDoc, schema)
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
