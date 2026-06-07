import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { insertTextIntoCodeBlockCm, resolveCodeBlockInputPolicyFromView } from '../boundary'
import { installCodeBlockCmPmClickExit } from './codeBlockCmPmClickExit'
import { codeBlockStartDocPos } from '../behavior/nav'
import {
  delegateCodeBlockCmNavigationKey,
  tryEnterCodeBlockCmOnBoundaryArrow,
} from './codeBlockCmPmDelegate'

/** Block ProseMirror mirror typing inside fenced code blocks; forward to embedded CM when present. */
export function createCodeBlockCmInputPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('lunaCodeBlockCmInput'),
    view(view) {
      const disposeClickExit = installCodeBlockCmPmClickExit(editor, view)
      return { destroy: disposeClickExit }
    },
    props: {
      handleKeyDown(view, event) {
        if (view.composing) return false
        const key = event.key
        if (
          key === 'ArrowDown' ||
          key === 'ArrowUp' ||
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'Home' ||
          key === 'End'
        ) {
          if (key === 'ArrowDown' || key === 'ArrowUp') {
            if (tryEnterCodeBlockCmOnBoundaryArrow(view, key)) {
              event.preventDefault()
              return true
            }
          }

          const { $from } = view.state.selection
          const policy = resolveCodeBlockInputPolicyFromView(view, $from)
          if (!policy.shouldDelegateToCm) return false

          const start = policy.blockPos ?? codeBlockStartDocPos($from)
          if (start == null) return false

          let wrap: HTMLElement
          try {
            wrap = view.nodeDOM(start) as HTMLElement
          } catch {
            return false
          }
          if (!wrap) return false

          const range = start + 1
          const pmOffset = Math.max(0, view.state.selection.to - range)
          if (delegateCodeBlockCmNavigationKey(wrap, key, pmOffset, view.dom)) {
            event.preventDefault()
            return true
          }
        }
        return false
      },
      handleTextInput(view, _from, _to, text) {
        if (view.composing) return false
        const { $from } = view.state.selection
        const policy = resolveCodeBlockInputPolicyFromView(view, $from)
        if (!policy.shouldDelegateToCm) return false

        const start = policy.blockPos ?? codeBlockStartDocPos($from)
        if (start == null) return false

        let wrap: HTMLElement
        try {
          wrap = view.nodeDOM(start) as HTMLElement
        } catch {
          return false
        }
        if (!wrap) return false

        insertTextIntoCodeBlockCm(wrap, text)
        return true
      },
    },
  })
}
