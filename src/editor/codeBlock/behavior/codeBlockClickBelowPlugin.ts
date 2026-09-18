import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { tryFocusParagraphOnHardBlockPointer } from './codeBlockClickBelow'

export function createCodeBlockClickBelowPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('lunaCodeBlockClickBelow'),
    props: {
      handleDOMEvents: {
        click(view, event) {
          if (!(event instanceof MouseEvent)) return false
          if (tryFocusParagraphOnHardBlockPointer(editor, view, event)) {
            event.preventDefault()
            return true
          }
          return false
        },
      },
    },
  })
}
