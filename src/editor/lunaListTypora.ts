import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Press Enter for an empty **Normal** list item: Exit the list as a paragraph (Typora/Notion style).
 * Empty task items (taskItem) are not processed and handed over to the splitListItem of TaskItem so that Enter inherits `- [ ]`.
 * A higher priority needs to be registered before ListItem's Enter (splitListItem).
 */
export const LunaListTypora = Extension.create({
  name: 'lunaListTypora',

  priority: 1100,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const sel = state.selection
        if (!(sel instanceof TextSelection) || !sel.empty) return false
        const { $from } = sel
        const parent = $from.parent
        if (parent.type.name !== 'paragraph' || parent.content.size > 0 || $from.parentOffset > 0) return false

        for (let d = $from.depth; d > 0; d -= 1) {
          const n = $from.node(d)
          if (n.type.name === 'taskItem') {
            return false
          }
          if (n.type.name === 'listItem') {
            // Keep caret inside the list: merge into the previous item when possible.
            // Lifting only when this is the first item (Typora-style exit).
            if (editor.commands.joinItemBackward()) {
              return true
            }
            return editor.commands.liftListItem('listItem')
          }
        }
        return false
      },
      Enter: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const sel = state.selection
        if (!(sel instanceof TextSelection) || !sel.empty) return false
        const { $from } = sel
        const parent = $from.parent
        if (parent.type.name !== 'paragraph' || parent.content.size > 0) return false

        for (let d = $from.depth; d > 0; d -= 1) {
          const n = $from.node(d)
          if (n.type.name === 'listItem') {
            return editor.commands.liftListItem('listItem')
          }
          //taskItem: Empty line Enter must be given to TaskItem's splitListItem to inherit `- [ ]` New line
        }
        return false
      },
    }
  },
})
