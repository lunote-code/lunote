import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { arbitrateAuthority } from './deterministic'
import { shouldBypassPmSelectionSync } from './nativeInput'
import { commitPmSelection } from './selectionRuntime'

const PM_SELECTION_BRIDGE_KEY = new PluginKey('lunaDocumentPmSelection')

/**
 * PM selection → Document Runtime (disable DOM getSelection as true source)
 */
export function createPmSelectionBridgePlugin(): Plugin {
  return new Plugin({
    key: PM_SELECTION_BRIDGE_KEY,
    view() {
      return {
        update(view, prevState) {
          if (shouldBypassPmSelectionSync()) return
          if (view.state.selection.eq(prevState.selection)) return
          const { from, to } = view.state.selection
          arbitrateAuthority({ domain: 'selection', incoming: 'pm' })
          commitPmSelection(from, to)
        },
      }
    },
  })
}

export function bindPmSelectionToDocumentRuntime(editor: Editor): void {
  if (editor.state.plugins.some((p) => p.spec.key === PM_SELECTION_BRIDGE_KEY)) return
  //Plugins should be registered via extension; only the current selection is synchronized here
  const { from, to } = editor.state.selection
  commitPmSelection(from, to)
}
