import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Extension, mergeAttributes, type Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { cellTextAlignAttrsSpec, parseCellTextAlign } from './lunaTableCellAlign'

/**
 * `heading` is prohibited in table cells: GFM pipeline table serialization only uses `textContent` (see markdownDocument.ts),
 * If heading is retained in the grid, there will be an asymmetric structure in which PM is heading and Markdown has no `#`.
 *
 * Allowed blocks are consistent with the Luna editing extension (no heading, no nested tables).
 */
const LUNA_TABLE_CELL_BLOCK_CONTENT =
  '(paragraph | bulletList | orderedList | taskList | blockquote | codeBlock | mermaidBlock | horizontalRule | callout | rawBlock | tocDirective | blockMath)+'

export const LunaTableCell = TableCell.extend({
  content: LUNA_TABLE_CELL_BLOCK_CONTENT,
  addAttributes() {
    const parent = this.parent?.()
    const base = typeof parent === 'function' ? (parent as () => Record<string, unknown>)() : parent ?? {}
    return { ...base, ...cellTextAlignAttrsSpec() }
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = parseCellTextAlign(node.attrs.lunaCellTextAlign) ?? parseCellTextAlign(node.attrs.align)
    return [
      'td',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, a ? { style: `text-align: ${a}` } : {}),
      0,
    ]
  },
})

export const LunaTableHeader = TableHeader.extend({
  content: LUNA_TABLE_CELL_BLOCK_CONTENT,
  addAttributes() {
    const parent = this.parent?.()
    const base = typeof parent === 'function' ? (parent as () => Record<string, unknown>)() : parent ?? {}
    return {
      ...base,
      ...cellTextAlignAttrsSpec(),
      /** `/table` DSL column type: text | number | date | currency | status (see subsequent expansion for serialization)*/
      lunaColSemantic: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-luna-col-semantic'),
        renderHTML: (attrs) => {
          const v = (attrs as { lunaColSemantic?: string | null }).lunaColSemantic
          return v ? { 'data-luna-col-semantic': v } : {}
        },
      },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = parseCellTextAlign(node.attrs.lunaCellTextAlign) ?? parseCellTextAlign(node.attrs.align)
    return [
      'th',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, a ? { style: `text-align: ${a}` } : {}),
      0,
    ]
  },
})

function isInTableCellOrHeader($pos: { node: (d: number) => PMNode; depth: number }): boolean {
  for (let d = $pos.depth; d > 0; d -= 1) {
    const n = $pos.node(d).type.name
    if (n === 'tableCell' || n === 'tableHeader') return true
  }
  return false
}

/** Whether the selection is within a table cell (used to intercept title shortcut keys, etc.)*/
export function isSelectionInsideTableCell(editor: Editor): boolean {
  const { $from } = editor.state.selection
  return isInTableCellOrHeader($from)
}

function collectHeadingReplacementsInTableCells(doc: PMNode, schema: Schema): { from: number; to: number; para: PMNode }[] {
  const heading = schema.nodes.heading
  const paragraph = schema.nodes.paragraph
  if (!heading || !paragraph) return []

  const replacements: { from: number; to: number; para: PMNode }[] = []

  doc.descendants((node, pos) => {
    if (node.type !== heading) return true
    const $pos = doc.resolve(pos + 1)
    if (!isInTableCellOrHeader($pos)) return true
    const para = paragraph.create(null, node.content)
    replacements.push({ from: pos, to: pos + node.nodeSize, para })
    return false
  })

  return replacements
}

/**
 * Demotes headings within table cells to paragraphs (preserving inline and marks).
 * For explicit fix after loading or pasting HTML from old data.
 */
export function flattenHeadingsInsideTableCells(editor: Editor): boolean {
  const { state } = editor
  const replacements = collectHeadingReplacementsInTableCells(state.doc, state.schema)
  if (replacements.length === 0) return false

  replacements.sort((a, b) => b.from - a.from)
  let tr = state.tr
  for (const { from, to, para } of replacements) {
    tr = tr.replaceWith(from, to, para)
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

const headingGuardKey = new PluginKey('lunaTableCellHeadingGuard')

/**
 * Scan after document changes: If there is still heading in the box (for example, pasting HTML), it will be automatically downgraded to paragraph.
 */
export const LunaTableCellHeadingGuard = Extension.create({
  name: 'lunaTableCellHeadingGuard',

  addProseMirrorPlugins() {
    let viewRef: EditorView | null = null
    return [
      new Plugin({
        key: headingGuardKey,
        view(view) {
          viewRef = view
          return {}
        },
        appendTransaction(transactions, _oldState, newState) {
          if (viewRef?.composing) return null
          if (!transactions.some((t) => t.docChanged)) return null
          const replacements = collectHeadingReplacementsInTableCells(newState.doc, newState.schema)
          if (replacements.length === 0) return null
          replacements.sort((a, b) => b.from - a.from)
          let tr = newState.tr
          for (const { from, to, para } of replacements) {
            tr = tr.replaceWith(from, to, para)
          }
          return tr
        },
      }),
    ]
  },
})
