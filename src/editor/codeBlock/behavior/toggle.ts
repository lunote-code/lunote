import type { Editor } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'

/** Standardize before writing the code block: remove unnecessary newlines at the beginning and end (paste often with the end `\n`)*/
export function normalizeCodeBlockInsertText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '')
}

/** The document interval of the "logical line" where caret is located in the text block (consistent with `\n` of `textBetween`)*/
export function getTextblockLineDocRange($from: ResolvedPos): { from: number; to: number; text: string } | null {
  const parent = $from.parent
  if (!parent.isTextblock) return null

  const blockStart = $from.start()
  const full = parent.textBetween(0, parent.content.size, '\n', '\n')
  const caret = $from.parentOffset
  const before = full.slice(0, caret)
  const lineStart = before.lastIndexOf('\n') + 1
  const nl = full.indexOf('\n', caret)
  const lineEnd = nl === -1 ? full.length : nl
  const text = full.slice(lineStart, lineEnd)

  return {
    from: blockStart + lineStart,
    to: blockStart + lineEnd,
    text,
  }
}

export type InsertCodeBlockRange = { from: number; to: number; text: string }

/** Calculate the range that Cmd+Shift+K should convert: if there is a selection, use the selection, otherwise only the current row*/
export function resolveInsertCodeBlockRange(editor: Editor): InsertCodeBlockRange | null {
  const { state } = editor
  const { selection } = state
  const { $from } = selection

  if (!selection.empty) {
    return {
      from: selection.from,
      to: selection.to,
      text: state.doc.textBetween(selection.from, selection.to, '\n', '\n'),
    }
  }

  return getTextblockLineDocRange($from)
}

export function insertCodeBlockAtRange(editor: Editor, range: InsertCodeBlockRange, language: string): boolean {
  const text = normalizeCodeBlockInsertText(range.text)
  return editor
    .chain()
    .focus()
    .insertContentAt(
      { from: range.from, to: range.to },
      {
        type: 'codeBlock',
        attrs: { language },
        content: text ? [{ type: 'text', text }] : [],
      },
    )
    .run()
}
