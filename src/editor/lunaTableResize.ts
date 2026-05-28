import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'

function cellDocPos(tablePos: number, table: PMNode, row: number, col: number): number {
  const map = TableMap.get(table)
  return tablePos + map.positionAt(row, col, table) + 1
}

/**
 * Resize the current table to targetRows × targetCols (simple rectangular table; relies on pm-tables command).
 * The selection needs to fall within the table; read table nodes from tablePos.
 */
export function resizeTableToDimensions(
  editor: Editor,
  tablePos: number,
  targetRows: number,
  targetCols: number,
): boolean {
  const maxDim = 20
  const tr = Math.max(1, Math.min(maxDim, targetRows))
  const tc = Math.max(1, Math.min(maxDim, targetCols))

  for (let guard = 0; guard < 48; guard += 1) {
    const table = editor.state.doc.nodeAt(tablePos) as PMNode | null
    if (!table || table.type.name !== 'table') return false
    const map = TableMap.get(table)
    const rows = map.height
    const cols = map.width
    if (rows === tr && cols === tc) return true

    if (rows < tr) {
      const inner = cellDocPos(tablePos, table, rows - 1, 0)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, inner)))
      if (!editor.chain().focus().addRowAfter().run()) return false
      continue
    }
    if (rows > tr) {
      if (rows <= 1) return false
      const inner = cellDocPos(tablePos, table, rows - 1, 0)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, inner)))
      if (!editor.chain().focus().deleteRow().run()) return false
      continue
    }
    if (cols < tc) {
      const inner = cellDocPos(tablePos, table, 0, cols - 1)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, inner)))
      if (!editor.chain().focus().addColumnAfter().run()) return false
      continue
    }
    if (cols > tc) {
      if (cols <= 1) return false
      const inner = cellDocPos(tablePos, table, 0, cols - 1)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, inner)))
      if (!editor.chain().focus().deleteColumn().run()) return false
      continue
    }
  }
  return false
}
