import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorState, Transaction } from 'prosemirror-state'

import { assertNoPasteStructuralInjection } from './inputLayerAst'
import { getInputLayerSource, INPUT_LAYER_SOURCE_META, isPasteLayerSource } from './inputLayerPaste'

export const INPUT_LAYER_PASTE_GUARD_KEY = new PluginKey('lunaInputLayerPasteGuard')

const PASTE_CODEBLOCK_ERROR = 'Invalid paste transformation: codeBlock auto-generation is forbidden'

function transactionsIncludePaste(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) => isPasteLayerSource(getInputLayerSource(tr)))
}

/**
 * Runtime guard: Paste transactions must not inject codeBlock/mermaidBlock and must not increase the number of paragraph blocks.
 */
export function assertPasteDidNotCreateCodeBlock(oldState: EditorState, newState: EditorState, transactions: readonly Transaction[]): void {
  if (!transactionsIncludePaste(transactions)) return
  try {
    assertNoPasteStructuralInjection(oldState.doc, newState.doc)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('codeBlock')) {
      throw new Error(PASTE_CODEBLOCK_ERROR, { cause: e })
    }
    throw e instanceof Error ? e : new Error(msg, { cause: e })
  }
}

export function createInputLayerPasteGuardPlugin(): Plugin {
  return new Plugin({
    key: INPUT_LAYER_PASTE_GUARD_KEY,
    appendTransaction(transactions, oldState, newState) {
      assertPasteDidNotCreateCodeBlock(oldState, newState, transactions)
      return null
    },
    filterTransaction(tr) {
      const source = getInputLayerSource(tr)
      if (!isPasteLayerSource(source)) return true
      const before = tr.before
      if (!before) return true
      try {
        assertNoPasteStructuralInjection(before, tr.doc, {
          allowRichStructure: source === 'paste-rich',
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('codeBlock')) throw new Error(PASTE_CODEBLOCK_ERROR, { cause: e })
        throw e instanceof Error ? e : new Error(msg, { cause: e })
      }
      return true
    },
  })
}

export { INPUT_LAYER_SOURCE_META, PASTE_CODEBLOCK_ERROR }
