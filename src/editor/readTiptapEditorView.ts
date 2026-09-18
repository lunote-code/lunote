import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

/** TipTap throws when accessing `editor.view` before mount or after destroy. */
export function readTiptapEditorView(editor: Editor | null | undefined): EditorView | null {
  if (!editor || editor.isDestroyed) return null
  try {
    const view = editor.view
    return view?.dom ? view : null
  } catch {
    return null
  }
}
