import { Extension } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

import {
  isCaretAfterImageInImageOnlyParagraph,
  resolveEmptyParagraphBelowImage,
} from './lunaImageParagraphUtils'

/**
 * Prevent Backspace/Delete from removing image blocks when the caret sits on the
 * empty paragraph below an image or at the end of an image-only paragraph.
 * Vertical arrow navigation is handled by LunaBlockVerticalNav.
 */
export const LunaImageParagraphGuard = Extension.create({
  name: 'lunaImageParagraphGuard',

  priority: 2055,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const sel = state.selection
        if (!(sel instanceof TextSelection) || !sel.empty) return false

        const below = resolveEmptyParagraphBelowImage(sel.$from)
        if (below) {
          let tr = state.tr.delete(below.emptyParagraphFrom, below.emptyParagraphTo)
          tr = tr.setSelection(TextSelection.create(tr.doc, below.caretAfterImage))
          editor.view.dispatch(tr.scrollIntoView())
          return true
        }

        if (isCaretAfterImageInImageOnlyParagraph(sel.$from)) {
          const imagePos = sel.from - 1
          editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)).scrollIntoView())
          return true
        }

        return false
      },
      Delete: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const sel = state.selection
        if (!(sel instanceof TextSelection) || !sel.empty) return false

        if (resolveEmptyParagraphBelowImage(sel.$from)) {
          // Forward delete at the start of the spacer paragraph must not reach backward into the image.
          return true
        }

        if (isCaretAfterImageInImageOnlyParagraph(sel.$from)) {
          const imagePos = sel.from - 1
          editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)).scrollIntoView())
          return true
        }

        return false
      },
    }
  },
})
