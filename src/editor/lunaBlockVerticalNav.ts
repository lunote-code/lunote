import { Extension, type Editor } from '@tiptap/core'

import { isCodeBlockCmFocused } from './codeBlock/cm/codeBlockCmFocus'
import { findAdjacentCodeBlockPos } from './lunaBlockVerticalNavUtils'
import { resolveVerticalNavTarget } from './lunaBlockVerticalNavUtils'

function moveVerticalAcrossBlocks(editor: Editor, dir: 'up' | 'down'): boolean {
  if (editor.view.composing) return false
  if (isCodeBlockCmFocused()) return false

  const { state } = editor
  const sel = state.selection

  if (findAdjacentCodeBlockPos(sel.$from, dir, editor.view) != null) return false

  const next = resolveVerticalNavTarget(sel, dir)
  if (!next || next.eq(sel)) return false

  editor.view.dispatch(state.tr.setSelection(next).scrollIntoView())
  editor.view.focus()
  return true
}

/** ArrowUp/ArrowDown across lists, images, paragraphs, and blocks when PM navigation stalls. */
export const LunaBlockVerticalNav = Extension.create({
  name: 'lunaBlockVerticalNav',

  priority: 2056,

  addKeyboardShortcuts() {
    return {
      ArrowUp: ({ editor }) => moveVerticalAcrossBlocks(editor, 'up'),
      ArrowDown: ({ editor }) => moveVerticalAcrossBlocks(editor, 'down'),
    }
  },
})
