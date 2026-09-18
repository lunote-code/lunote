import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { isPlainTextTabBlockType } from './blockEditingPolicy'
import { isSelectionInsideTableCell } from './lunaTableCell'
import { isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { isMermaidSourceKeyboardActive } from './mermaid/mermaidSourceDom'

const TAB_SPACES = '    '

function isInListItem($from: { depth: number; node: (d: number) => { type: { name: string } } }): {
  name: 'listItem' | 'taskItem'
  depth: number
} | null {
  for (let d = $from.depth; d > 0; d -= 1) {
    const name = $from.node(d).type.name
    if (name === 'listItem' || name === 'taskItem') return { name, depth: d }
  }
  return null
}

function isPlainTextBlock($from: { parent: { type: { name: string; spec: { code?: boolean } } } }): boolean {
  const parent = $from.parent
  if (parent.type.spec.code) return false
  return isPlainTextTabBlockType(parent.type.name)
}

function collectPlainTextLineIndentPositions(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): number[] {
  const positions: number[] = []

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return

    const blockStart = pos + 1
    const blockEnd = pos + node.nodeSize - 1
    const lineStarts: number[] = [blockStart]

    node.forEach((child, offset) => {
      if (child.type.name === 'hardBreak') {
        lineStarts.push(blockStart + offset + child.nodeSize)
      }
    })

    for (let i = 0; i < lineStarts.length; i += 1) {
      const lineStart = lineStarts[i]!
      const lineEnd = i + 1 < lineStarts.length ? lineStarts[i + 1]! : blockEnd
      if (lineStart < to && lineEnd > from) positions.push(lineStart)
    }
  })

  return positions
}

function insertTabSpacesAtSelection(editor: Editor): boolean {
  const { state } = editor
  const { from, to, empty } = state.selection
  if (empty) {
    return editor.chain().focus().insertContent(TAB_SPACES).run()
  }

  const indentPositions = collectPlainTextLineIndentPositions(state.doc, from, to)
  if (indentPositions.length === 0) return false

  let tr = state.tr
  for (const pos of [...indentPositions].sort((a, b) => b - a)) {
    tr = tr.insertText(TAB_SPACES, pos, pos)
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * Unify Tab/Shift-Tab:
 * - List: sink / lift first; if failed, insert a space at the cursor (to prevent the browser from moving focus to the start of line check box)
 * - Titles, paragraphs, etc.: insert 4 spaces
 * - Code blocks, tables, Mermaid source code: handed over to dedicated extensions
 */
export const LunaTabInText = Extension.create({
  name: 'lunaTabInText',

  priority: 1750,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(view) {
          const root = view.dom
          const syncCheckboxTabIndex = () => {
            root.querySelectorAll<HTMLInputElement>('.pm-editor-task-list input[type="checkbox"]').forEach((el) => {
              el.tabIndex = -1
            })
          }
          syncCheckboxTabIndex()
          return {
            update(v: EditorView) {
              if (v.state.doc !== view.state.doc) syncCheckboxTabIndex()
            },
          }
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { $from } = state.selection
        if (isPosInsideCodeSpecBlock($from)) return false
        if (isSelectionInsideTableCell(editor)) return false

        const list = isInListItem($from)
        if (list) {
          if (editor.commands.sinkListItem(list.name)) return true
          return insertTabSpacesAtSelection(editor)
        }

        if (isPlainTextBlock($from)) return insertTabSpacesAtSelection(editor)
        return false
      },

      'Shift-Tab': ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { $from } = state.selection
        if (isPosInsideCodeSpecBlock($from)) return false
        if (isSelectionInsideTableCell(editor)) return false

        const list = isInListItem($from)
        if (list) {
          if (editor.commands.liftListItem(list.name)) return true
          return false
        }
        return false
      },
    }
  },
})
