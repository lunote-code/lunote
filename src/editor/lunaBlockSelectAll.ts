import { Extension, type Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { CellSelection, cellAround, cellNear } from '@tiptap/pm/tables'

import { selectAllInMermaidBlock } from './mermaid/mermaidBlockSelection'
import { isMermaidInputKernelActive } from './mermaid/mermaidSourceInputFocus'

const CODE = 'codeBlock'
const MERMAID = 'mermaidBlock'
const CELL = 'tableCell'
const HEADER = 'tableHeader'
const TASK_ITEM = 'taskItem'
const LIST_ITEM = 'listItem'
const CALLOUT = 'callout'
const BLOCKQUOTE = 'blockquote'
const PARA = 'paragraph'
const HEADING = 'heading'

export function selectAllInCurrentBlock(editor: Editor): boolean {
  const state = editor.state
  const { $head } = state.selection

  if ($head.depth < 1) return false

  if (isMermaidInputKernelActive()) {
    return selectAllInMermaidBlock(editor)
  }

  if (state.selection instanceof NodeSelection && state.selection.node.type.name === MERMAID) {
    return selectAllInMermaidBlock(editor)
  }

  let mermaidD: number | null = null
  let codeD: number | null = null
  let cellD: number | null = null
  let taskItemD: number | null = null
  let listItemD: number | null = null
  let calloutD: number | null = null
  let blockquoteD: number | null = null
  let textD: number | null = null

  for (let d = 1; d <= $head.depth; d += 1) {
    const node = $head.node(d)
    const name = node.type.name
    if (name === MERMAID) mermaidD = d
    if (name === CODE) codeD = d
    if (name === CELL || name === HEADER) cellD = d
    if (name === TASK_ITEM) taskItemD = d
    if (name === LIST_ITEM) listItemD = d
    if (name === CALLOUT) calloutD = d
    if (name === BLOCKQUOTE) blockquoteD = d
    if (name === PARA || name === HEADING) textD = d
  }

  if (mermaidD !== null) {
    return selectAllInMermaidBlock(editor)
  }

  if (codeD !== null) {
    const node = $head.node(codeD)
    const pos = $head.before(codeD)
    const from = pos + 1
    const to = pos + node.nodeSize - 1
    if (from <= to) return editor.chain().focus().setTextSelection({ from, to }).run()
    return editor.chain().focus().setTextSelection(pos + 1).run()
  }

  if (cellD !== null) {
    try {
      const $cell = cellAround(state.selection.$head) ?? cellNear(state.selection.$head)
      const after = $cell?.nodeAfter
      if ($cell && after) {
        const role = after.type.spec.tableRole
        if (role === 'cell' || role === 'header_cell') {
          const sel = CellSelection.create(state.doc, $cell.pos, $cell.pos)
          editor.view.dispatch(state.tr.setSelection(sel).scrollIntoView())
          return true
        }
      }
    } catch {
      /*Fallback when non-table or structure exception occurs*/
    }
  }

  if (taskItemD !== null) {
    const pos = $head.before(taskItemD)
    return editor.chain().focus().setNodeSelection(pos).run()
  }

  if (listItemD !== null) {
    const pos = $head.before(listItemD)
    return editor.chain().focus().setNodeSelection(pos).run()
  }

  if (calloutD !== null) {
    const pos = $head.before(calloutD)
    return editor.chain().focus().setNodeSelection(pos).run()
  }

  if (blockquoteD !== null) {
    const pos = $head.before(blockquoteD)
    return editor.chain().focus().setNodeSelection(pos).run()
  }

  if (textD !== null) {
    const from = $head.start(textD)
    const to = $head.end(textD)
    return editor.chain().focus().setTextSelection({ from, to }).run()
  }

  return false
}

export const LunaBlockSelectAll = Extension.create({
  name: 'lunaBlockSelectAll',
  priority: 1100,

  addKeyboardShortcuts() {
    return {
      'Mod-a': ({ editor }) => selectAllInCurrentBlock(editor),
    }
  },
})
