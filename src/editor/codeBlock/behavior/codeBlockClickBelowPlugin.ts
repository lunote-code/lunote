import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { tryFocusParagraphBelowLastCodeBlockOnPointer } from './codeBlockClickBelow'

export function createCodeBlockClickBelowPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('lunaCodeBlockClickBelow'),
    props: {
      handleDOMEvents: {
        click(view, event) {
          if (!(event instanceof MouseEvent)) return false
          if (tryFocusParagraphBelowLastCodeBlockOnPointer(editor, view, event)) {
            event.preventDefault()
            return true
          }
          return false
        },
      },
    },
  })
}
