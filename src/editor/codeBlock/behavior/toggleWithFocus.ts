import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

import { insertCodeBlockAtRange, resolveInsertCodeBlockRange } from './toggle'

/**
 * Shortcut key/menu: After toggle fence code block, if the selection falls outside the codeBlock text range, it will be included in the content area.
 * `$from.start()` / `$from.end()` is already the endpoint of the legal range of text within the block, and further `+1` is prohibited (an empty block will cross the boundary).
 */
export function toggleCodeBlockWithFocusAndLog(editor: Editor, language = 'text'): boolean {
  const { $from } = editor.state.selection

  let ok: boolean
  if ($from.parent.type.name === 'codeBlock') {
    ok = editor.chain().focus().toggleCodeBlock({ language }).run()
  } else {
    const range = resolveInsertCodeBlockRange(editor)
    ok =
      range != null
        ? insertCodeBlockAtRange(editor, range, language)
        : editor.chain().focus().toggleCodeBlock({ language }).run()
  }

  if (!ok) return false
  let s = editor.state
  const moveSelectionIntoCodeBlock = (contentStart: number) => {
    editor.chain().focus().setTextSelection(contentStart).run()
    s = editor.state
  }
  if (s.selection instanceof NodeSelection && s.selection.node.type.name === 'codeBlock') {
    moveSelectionIntoCodeBlock(s.selection.from + 1)
  } else if (s.selection.$from.parent.type.name === 'codeBlock') {
    const $fromAfter = s.selection.$from
    const contentStart = $fromAfter.start()
    const contentEnd = $fromAfter.end()
    const p = s.selection.from
    if (p < contentStart || p > contentEnd) {
      moveSelectionIntoCodeBlock(contentStart)
    }
  } else {
    const $pos = s.selection.$from
    const nodeAfter = $pos.nodeAfter
    if (nodeAfter?.type.name === 'codeBlock') {
      moveSelectionIntoCodeBlock($pos.pos + 1)
    } else {
      const nodeBefore = $pos.nodeBefore
      if (nodeBefore?.type.name === 'codeBlock') {
        const start = $pos.pos - nodeBefore.nodeSize
        moveSelectionIntoCodeBlock(start + 1)
      }
    }
  }
  return true
}
