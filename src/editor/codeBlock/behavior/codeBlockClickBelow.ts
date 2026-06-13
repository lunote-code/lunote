import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

function resolveLastTopLevelCodeBlockPos(view: EditorView): number | null {
  const { doc } = view.state
  if (doc.childCount === 0) return null
  const lastIndex = doc.childCount - 1
  const last = doc.child(lastIndex)
  if (last.type.name !== 'codeBlock') return null

  let pos = 0
  for (let i = 0; i < lastIndex; i += 1) {
    pos += doc.child(i).nodeSize
  }
  return pos
}

function shouldHandlePointerBelowLastCodeBlock(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0) return false
  if (event.detail > 1) return false
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false

  const root = view.dom
  if (!(root instanceof HTMLElement)) return false
  if (!(event.target instanceof Node) || !root.contains(event.target)) return false

  const blockPos = resolveLastTopLevelCodeBlockPos(view)
  if (blockPos == null) return false

  const wrap = view.nodeDOM(blockPos)
  if (!(wrap instanceof HTMLElement)) return false
  if (wrap.contains(event.target)) return false

  const rootRect = root.getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()
  if (event.clientX < rootRect.left || event.clientX > rootRect.right) return false
  if (event.clientY <= wrapRect.bottom + 1) return false
  if (event.clientY > rootRect.bottom + 1) return false

  return true
}

function insertEditableParagraphAtDocEnd(editor: Editor, view: EditorView): boolean {
  if (editor.isDestroyed) return false
  const paragraph = view.state.schema.nodes.paragraph
  if (!paragraph) return false
  if (view.state.doc.lastChild?.type.name !== 'codeBlock') return false

  const insertPos = view.state.doc.content.size
  let tr = view.state.tr.insert(insertPos, paragraph.create())
  tr = tr.setSelection(TextSelection.create(tr.doc, Math.min(insertPos + 1, tr.doc.content.size)))
  view.dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

export function tryFocusParagraphBelowLastCodeBlockOnPointer(
  editor: Editor,
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (!shouldHandlePointerBelowLastCodeBlock(view, event)) return false
  return insertEditableParagraphAtDocEnd(editor, view)
}
