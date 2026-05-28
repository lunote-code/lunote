import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { getMermaidSourceBoundEditor, getMermaidSourceBridge } from '../../mermaid/mermaidSourceBridge'
import { CBR_COMMIT_META } from './syncGuard'
import { flushAllBlocksToPm } from './cbrToPmSync'
import { notifyPmDocChangedForBridge } from './pmToCbrSync'

const CBR_BRIDGE_SYNC_KEY = new PluginKey('lunaCbrBridgeSync')

/**
 * PM ↔ CBR Bridge: transaction driver bidirectional synchronization.
 * - Before transaction: CBR → PM flush
 * - After transaction: PM → CBR draft sync (with guard, skip CBR source transaction)
 */
export const LunaCbrBridgeSync = Extension.create({
  name: 'lunaCbrBridgeSync',
  priority: 1100,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: CBR_BRIDGE_SYNC_KEY,
        filterTransaction(tr) {
          if (!tr.docChanged) return true
          if (tr.getMeta(CBR_COMMIT_META)) return true

          const bridge = getMermaidSourceBridge()
          const editor = getMermaidSourceBoundEditor()
          if (!bridge || !editor) return true

          bridge.flushBeforeDocChange(editor)
          return true
        },
        appendTransaction(transactions) {
          const bridge = getMermaidSourceBridge()
          const editor = getMermaidSourceBoundEditor()
          if (!bridge || !editor) return null

          let docChanged = false
          for (const tr of transactions) {
            if (!tr.docChanged) continue
            if (tr.getMeta(CBR_COMMIT_META)) continue
            docChanged = true
          }

          if (docChanged) {
            notifyPmDocChangedForBridge(editor, transactions)
            bridge.notifyPmDocChanged(editor)
          }

          return null
        },
      }),
    ]
  },
})

export function flushAllCbrBlocksForSerialize(editor: Parameters<typeof flushAllBlocksToPm>[0]): void {
  flushAllBlocksToPm(editor, 'serialize')
}
