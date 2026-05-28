import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { resolveCodeBlockTextRange } from './codeBlockSelection'
import { isPosInsideCodeSpecBlock } from './lunaCodeContext'
import { isMermaidSourceKeyboardActive } from './mermaid/mermaidSourceDom'

const DEFAULT_TAB_SIZE = 4

function leadingIndentOfLineBeforeCursor(parentText: string, parentOffset: number): string {
  const before = parentText.slice(0, parentOffset)
  const lineStart = before.lastIndexOf('\n') + 1
  const linePrefix = before.slice(lineStart)
  return (linePrefix.match(/^[\t ]*/u) ?? [''])[0]
}

/**
 * High priority keyboard layer: inside a `spec.code` block (e.g. fenced `codeBlock`)
 * - Enter: Insert newline and continue current line indentation (space/Tab)
 * - Tab/Shift-Tab: Indent/anti-indent to avoid being snatched away by table expansion
 *
 * Requires registration in extension list; relies on `priority` higher than Table / StarterKit keymap.
 */
export const LunaCodeFenceGuard = Extension.create({
  name: 'lunaCodeFenceGuard',

  priority: 2000,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection
        if (!isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        const blockPos = $from.before()
        const block = state.doc.nodeAt(blockPos)
        if (!block || block.type.name !== 'codeBlock') return false
        if (block.textContent.length > 0) return false
        const para = state.schema.nodes.paragraph
        if (!para) return false
        const parent = $from.node($from.depth - 1)
        const index = $from.index($from.depth - 1)
        if (!parent.canReplaceWith(index, index + 1, para)) return false
        const tr = state.tr.replaceWith(blockPos, blockPos + block.nodeSize, para.create())
        tr.setSelection(TextSelection.create(tr.doc, blockPos + 1)).scrollIntoView()
        editor.view.dispatch(tr)
        return true
      },
      Delete: ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection
        if (!isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        const blockPos = $from.before()
        const block = state.doc.nodeAt(blockPos)
        if (!block || block.type.name !== 'codeBlock') return false
        if (block.textContent.length > 0) return false
        const para = state.schema.nodes.paragraph
        if (!para) return false
        const parent = $from.node($from.depth - 1)
        const index = $from.index($from.depth - 1)
        if (!parent.canReplaceWith(index, index + 1, para)) return false
        const tr = state.tr.replaceWith(blockPos, blockPos + block.nodeSize, para.create())
        tr.setSelection(TextSelection.create(tr.doc, blockPos + 1)).scrollIntoView()
        editor.view.dispatch(tr)
        return true
      },
      Enter: ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        const { $from } = selection
        if (!isPosInsideCodeSpecBlock($from)) return false

        const ctx = resolveCodeBlockTextRange($from)
        if (!ctx) return false

        const full = state.doc.textBetween(ctx.contentFrom, ctx.contentTo, '\n', '\n')
        const indent = leadingIndentOfLineBeforeCursor(full, ctx.offset)

        let tr = state.tr
        const { from, to } = tr.selection
        if (from !== to) tr = tr.delete(from, to)
        const pos = tr.selection.from
        tr = tr.insertText(`\n${indent}`, pos)
        const caret = pos + 1 + indent.length
        tr = tr.setSelection(TextSelection.create(tr.doc, caret)).scrollIntoView()
        editor.view.dispatch(tr)
        return true
      },

      Tab: ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection
        if (!isPosInsideCodeSpecBlock($from)) return false

        const tabSize = DEFAULT_TAB_SIZE
        const indent = ' '.repeat(tabSize)
        if (empty) {
          const tr = state.tr.insertText(indent, selection.from).scrollIntoView()
          editor.view.dispatch(tr)
          return true
        }
        return editor.commands.command(({ tr, dispatch }) => {
          const { from, to } = selection
          const text = state.doc.textBetween(from, to, '\n', '\n')
          const lines = text.split('\n')
          const indentedText = lines.map((line) => indent + line).join('\n')
          tr.replaceWith(from, to, state.schema.text(indentedText))
          if (dispatch) dispatch(tr.scrollIntoView())
          return true
        })
      },

      'Shift-Tab': ({ editor }) => {
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection
        if (!isPosInsideCodeSpecBlock($from)) return false

        const tabSize = DEFAULT_TAB_SIZE
        if (empty) {
          return editor.commands.command(({ tr }) => {
            const { pos } = $from
            const codeBlockStart = $from.start()
            const codeBlockEnd = $from.end()
            const allText = state.doc.textBetween(codeBlockStart, codeBlockEnd, '\n', '\n')
            const lines = allText.split('\n')
            let currentLineIndex = 0
            let charCount = 0
            const relativeCursorPos = pos - codeBlockStart
            for (let i = 0; i < lines.length; i += 1) {
              if (charCount + lines[i].length >= relativeCursorPos) {
                currentLineIndex = i
                break
              }
              charCount += lines[i].length + 1
            }
            const currentLine = lines[currentLineIndex]
            const leadingSpaces = currentLine.match(/^ */u)?.[0] ?? ''
            const spacesToRemove = Math.min(leadingSpaces.length, tabSize)
            if (spacesToRemove === 0) return true
            let lineStartPos = codeBlockStart
            for (let i = 0; i < currentLineIndex; i += 1) {
              lineStartPos += lines[i].length + 1
            }
            tr.delete(lineStartPos, lineStartPos + spacesToRemove)
            const cursorPosInLine = pos - lineStartPos
            if (cursorPosInLine <= spacesToRemove) {
              tr.setSelection(TextSelection.create(tr.doc, lineStartPos))
            }
            return true
          })
        }
        return editor.commands.command(({ tr }) => {
          const { from, to } = selection
          const text = state.doc.textBetween(from, to, '\n', '\n')
          const lines = text.split('\n')
          const reverseIndentText = lines
            .map((line) => {
              const leadingSpaces = line.match(/^ */u)?.[0] ?? ''
              const spacesToRemove = Math.min(leadingSpaces.length, tabSize)
              return line.slice(spacesToRemove)
            })
            .join('\n')
          tr.replaceWith(from, to, state.schema.text(reverseIndentText))
          return true
        })
      },
    }
  },
})
