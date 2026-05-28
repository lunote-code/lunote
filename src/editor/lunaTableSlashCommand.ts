import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

import { isCodeEditGuardActive } from './lunaCodeContext'
import { isSelectionInsideTableCell } from './lunaTableCell'
import { createFallbackTableNode, createTableNodeFromDsl, parseTableDSL } from './lunaTableDsl'

function paragraphTextWithHardBreaks(node: PMNode): string {
  if (!node.isTextblock) return ''
  let s = ''
  node.forEach((c) => {
    if (c.isText) s += c.text ?? ''
    else if (c.type.name === 'hardBreak') s += '\n'
  })
  return s
}

/**
 * `/table` DSL within a paragraph: Press Enter at the end of the line to replace the entire paragraph with a table (single transaction, undo available).
 * When parsing fails, a default 3×3 empty table is inserted and editing is not blocked.
 */
export const LunaTableSlashCommand = Extension.create({
  name: 'lunaTableSlashCommand',
  priority: 1850,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const editor = this.editor
        if (editor.view.composing) return false
        if (isCodeEditGuardActive(editor.state)) return false
        if (isSelectionInsideTableCell(editor)) return false

        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const parent = $from.parent
        if (parent.type.name !== 'paragraph') return false
        if ($from.parentOffset !== parent.content.size) return false

        const raw = paragraphTextWithHardBreaks(parent)
        const trimmed = raw.trimStart()
        if (!/^\/?table\b/iu.test(trimmed)) return false

        const from = $from.before()
        const to = $from.after()
        let table: PMNode
        try {
          const parsed = parseTableDSL(trimmed)
          table = parsed ? createTableNodeFromDsl(editor.schema, parsed) : createFallbackTableNode(editor.schema)
        } catch {
          table = createFallbackTableNode(editor.schema)
        }

        const tr = editor.state.tr.replaceWith(from, to, table)
        const inner = tr.doc.resolve(Math.min(from + 2, tr.doc.content.size))
        editor.view.dispatch(tr.setSelection(TextSelection.near(inner, 1)))
        return true
      },
    }
  },
})
