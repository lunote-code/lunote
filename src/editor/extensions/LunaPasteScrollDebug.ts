import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import {
  capturePasteScrollSnapshot,
  debugPasteScroll,
} from '../pasteScrollDebug'

/**
 * Optional PM instrumentation for paste-related scroll jumps.
 * No-op unless `localStorage luna.debug.pasteScroll = 1`.
 */
export const LunaPasteScrollDebug = Extension.create({
  name: 'lunaPasteScrollDebug',
  priority: 999,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: (tr, state) => {
          if (!import.meta.env.DEV) return true
          if (!tr.docChanged && !tr.selectionSet) return true
          const scrollIntoView =
            Object.prototype.hasOwnProperty.call(tr, 'scrollIntoView') &&
            (tr as typeof tr & { scrollIntoView?: boolean }).scrollIntoView === true
          if (!scrollIntoView && !tr.docChanged) return true
          debugPasteScroll('pm-filter-transaction', {
            docChanged: tr.docChanged,
            selectionSet: tr.selectionSet,
            scrollIntoView,
            steps: tr.steps.length,
            selectionBefore: { from: state.selection.from, to: state.selection.to },
            selectionAfter: tr.selectionSet
              ? { from: tr.selection.from, to: tr.selection.to }
              : null,
            uiEvent: tr.getMeta('uiEvent'),
            pasteMeta: tr.getMeta('paste'),
            inputLayerSource: tr.getMeta('inputLayerSource'),
          })
          return true
        },
        view() {
          return {
            update(nextView, prevState) {
              if (!import.meta.env.DEV) return
              const docChanged = !nextView.state.doc.eq(prevState.doc)
              const selectionChanged = !nextView.state.selection.eq(prevState.selection)
              if (!docChanged && !selectionChanged) return
              const pmDom = nextView.dom as HTMLElement
              debugPasteScroll('pm-view-updated', {
                docChanged,
                selectionChanged,
                selection: {
                  from: nextView.state.selection.from,
                  to: nextView.state.selection.to,
                },
                snapshot: capturePasteScrollSnapshot(pmDom),
              })
            },
          }
        },
      }),
    ]
  },
})
