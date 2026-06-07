import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { getBlock, getFocusedBlockId } from '../../codeBlockRuntime/codeBlockRuntimeStore'
import { getMermaidSourceBoundEditor, getMermaidSourceBridge } from '../../mermaid/mermaidSourceBridge'
import { isMermaidInputKernelActive } from '../../mermaid/mermaidSourceInputFocus'
import { isPasteLayerSource, INPUT_LAYER_SOURCE_META, type InputLayerSource } from '../../inputLayer/inputLayerPaste'
import { CBR_COMMIT_META } from './syncGuard'
import { flushAllBlocksToPm } from './cbrToPmSync'
import { notifyPmDocChangedForBridge } from './pmToCbrSync'

const CBR_BRIDGE_SYNC_KEY = new PluginKey('lunaCbrBridgeSync')

function shouldFlushMermaidBeforeDocChange(): boolean {
  if (!isMermaidInputKernelActive()) return false
  const focusedBlockId = getFocusedBlockId()
  if (!focusedBlockId) return false
  const focusedBlock = getBlock(focusedBlockId)
  if (!focusedBlock || focusedBlock.type !== 'mermaid') return false
  return focusedBlock.ui.dirty
}

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

          const inputSource = tr.getMeta(INPUT_LAYER_SOURCE_META) as InputLayerSource | undefined
          if (inputSource === 'typing' || isPasteLayerSource(inputSource)) {
            return true
          }

          if (!shouldFlushMermaidBeforeDocChange()) return true

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
