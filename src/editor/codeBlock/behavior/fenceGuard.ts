import { Extension, type Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import {
  delegateEnterToCodeBlockCm,
  focusCodeBlockCmAtPos,
  redirectFoldedCodeBlockKeyboard,
  resolveCodeBlockInputPolicy,
} from '../boundary'
import { deleteInActiveCodeBlockCm, deleteInFocusedCodeBlockCm } from '../cm/codeBlockCmFocus'
import { resolveCodeBlockTextRange } from '../behavior/selection'
import { isPosInsideCodeSpecBlock } from '../../lunaCodeContext'
import { isMermaidSourceKeyboardActive } from '../../mermaid/mermaidSourceDom'
import { removeOneIndentLevel } from './indent'
import { shouldRejectCodeBlockEnterNewline } from './trailingEmptyLines'

const DEFAULT_TAB_SIZE = 4

function redirectFoldedCodeBlockInput(editor: Editor): boolean {
  const { $from } = editor.state.selection
  const policy = resolveCodeBlockInputPolicy(editor, $from)
  if (!policy.shouldRedirectFoldedKeyboard || policy.blockPos == null) return false
  return redirectFoldedCodeBlockKeyboard(editor, policy.blockPos)
}

function focusEmbeddedCodeMirrorOrConsume(editor: Editor): boolean {
  const { $from } = editor.state.selection
  const policy = resolveCodeBlockInputPolicy(editor, $from)
  if (policy.blockPos != null) {
    focusCodeBlockCmAtPos(editor, policy.blockPos)
  }
  return true
}

function delegateEnterToEmbeddedCodeMirror(editor: Editor): boolean {
  const { $from } = editor.state.selection
  const policy = resolveCodeBlockInputPolicy(editor, $from)
  if (policy.blockPos == null) return focusEmbeddedCodeMirrorOrConsume(editor)
  return delegateEnterToCodeBlockCm(editor, policy.blockPos) || focusEmbeddedCodeMirrorOrConsume(editor)
}

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
        const { $from } = editor.state.selection
        const policy = resolveCodeBlockInputPolicy(editor, $from)
        if (policy.cmFocused) {
          deleteInActiveCodeBlockCm(editor, policy, false)
          return true
        }
        if (deleteInFocusedCodeBlockCm(false)) return true
        if (policy.shouldDelegateToCm) {
          return focusEmbeddedCodeMirrorOrConsume(editor)
        }
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!selection.empty) return false
        if (!isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        if (redirectFoldedCodeBlockInput(editor)) return true
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
        const { $from } = editor.state.selection
        const policy = resolveCodeBlockInputPolicy(editor, $from)
        if (policy.cmFocused) {
          deleteInActiveCodeBlockCm(editor, policy, true)
          return true
        }
        if (deleteInFocusedCodeBlockCm(true)) return true
        if (policy.shouldDelegateToCm) {
          return focusEmbeddedCodeMirrorOrConsume(editor)
        }
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!selection.empty) return false
        if (!isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        if (redirectFoldedCodeBlockInput(editor)) return true
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
        const { $from } = editor.state.selection
        const policy = resolveCodeBlockInputPolicy(editor, $from)
        if (policy.cmFocused) return false
        if (policy.shouldDelegateToCm) {
          return delegateEnterToEmbeddedCodeMirror(editor)
        }
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        if (!isPosInsideCodeSpecBlock($from)) return false
        if (redirectFoldedCodeBlockInput(editor)) return true

        const ctx = resolveCodeBlockTextRange($from)
        if (!ctx) return false

        const full = state.doc.textBetween(ctx.contentFrom, ctx.contentTo, '\n', '\n')
        if (shouldRejectCodeBlockEnterNewline(full, ctx.offset)) return true

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
        const { $from } = editor.state.selection
        const policy = resolveCodeBlockInputPolicy(editor, $from)
        if (policy.cmFocused) return false
        if (policy.shouldDelegateToCm) {
          return focusEmbeddedCodeMirrorOrConsume(editor)
        }
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!isPosInsideCodeSpecBlock($from)) return false
        if (redirectFoldedCodeBlockInput(editor)) return true

        const tabSize = DEFAULT_TAB_SIZE
        const indent = ' '.repeat(tabSize)
        if (selection.empty) {
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
        const { $from } = editor.state.selection
        const policy = resolveCodeBlockInputPolicy(editor, $from)
        if (policy.cmFocused) return false
        if (policy.shouldDelegateToCm) {
          return focusEmbeddedCodeMirrorOrConsume(editor)
        }
        if (isMermaidSourceKeyboardActive()) return false
        if (editor.view.composing) return false
        const { state } = editor
        const { selection } = state
        if (!isPosInsideCodeSpecBlock($from)) return false
        if (redirectFoldedCodeBlockInput(editor)) return true

        const tabSize = DEFAULT_TAB_SIZE
        if (selection.empty) {
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
            const { removed } = removeOneIndentLevel(currentLine, tabSize)
            if (removed === 0) return true
            let lineStartPos = codeBlockStart
            for (let i = 0; i < currentLineIndex; i += 1) {
              lineStartPos += lines[i].length + 1
            }
            tr.delete(lineStartPos, lineStartPos + removed)
            const cursorPosInLine = pos - lineStartPos
            if (cursorPosInLine <= removed) {
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
            .map((line) => removeOneIndentLevel(line, tabSize).text)
            .join('\n')
          tr.replaceWith(from, to, state.schema.text(reverseIndentText))
          return true
        })
      },
    }
  },
})
