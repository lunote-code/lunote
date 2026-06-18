import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { selectionInTaskItem, selectionInTaskLikeList } from './markdownStructuralTransforms'

/**
 * Ensure Enter in task lists always runs `splitListItem` before the default
 * keymap (`splitBlock` / `liftEmptyBlock`) or Typora empty-list lift logic.
 */
export const LunaTaskListEnter = Extension.create({
  name: 'lunaTaskListEnter',

  priority: 1200,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const sel = state.selection
        if (!(sel instanceof TextSelection) || !sel.empty) return false
        const { $from } = sel
        if ($from.parent.type.name !== 'paragraph') return false
        if (!selectionInTaskLikeList($from, state.schema)) return false

        const itemType = selectionInTaskItem($from) ? 'taskItem' : 'listItem'
        return editor.commands.splitListItem(itemType)
      },
    }
  },
})
