import { Fragment, Slice, type Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorState, Transaction } from 'prosemirror-state'
import { TextSelection } from '@tiptap/pm/state'
import { splitBlock } from 'prosemirror-commands'

import { isPosInsideCodeSpecBlock } from '../lunaCodeContext'

/** Transaction meta: mark input source (paste/menu paste/typing)*/
export const INPUT_LAYER_SOURCE_META = 'inputLayerSource'

export type InputLayerSource =
  | 'paste'
  | 'paste-rich'
  | 'paste-list'
  | 'paste-multiline'
  | 'typing'
  | 'command'

export function isPasteLayerSource(source: InputLayerSource | undefined): boolean {
  return (
    source === 'paste' ||
    source === 'paste-rich' ||
    source === 'paste-list' ||
    source === 'paste-multiline'
  )
}

export function setInputLayerSource(tr: Transaction, source: InputLayerSource): Transaction {
  return tr.setMeta(INPUT_LAYER_SOURCE_META, source)
}

export function getInputLayerSource(tr: Transaction): InputLayerSource | undefined {
  return tr.getMeta(INPUT_LAYER_SOURCE_META) as InputLayerSource | undefined
}

function selectionTouchesCodeSpecBlock(state: EditorState): boolean {
  const { from, to } = state.selection
  return (
    isPosInsideCodeSpecBlock(state.doc.resolve(from)) ||
    isPosInsideCodeSpecBlock(state.doc.resolve(to))
  )
}

/** Code blocks only accept literal text (including `\n`); hardBreak / splitBlock break paste. */
function applyCodeSpecPlainTextInsertion(
  state: EditorState,
  text: string,
  source: InputLayerSource,
): Transaction {
  const { from, to } = state.selection
  const normalized = text.replace(/\r\n/g, '\n')
  return setInputLayerSource(state.tr.insertText(normalized, from, to), source)
}

function buildPlainTextSlice(
  schema: EditorState['schema'],
  text: string,
): Slice | null {
  if (!text.includes('\n')) return null
  const hardBreak = schema.nodes.hardBreak
  if (!hardBreak) return null
  const parts = text.split('\n')
  const nodes: ProseMirrorNode[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (part) nodes.push(schema.text(part))
    if (i < parts.length - 1) nodes.push(hardBreak.create())
  }
  if (nodes.length === 0) return null
  return new Slice(Fragment.from(nodes), 0, 0)
}

function findListItemDepth($from: EditorState['selection']['$from']): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (name === 'listItem' || name === 'taskItem') return depth
  }
  return null
}

function normalizeMultilinePasteLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Multi-line plain text in bullet/ordered lists → one list item per line. */
function applyListMultilinePlainTextPaste(state: EditorState, text: string): Transaction | null {
  const listItemDepth = findListItemDepth(state.selection.$from)
  if (listItemDepth == null) return null

  const itemType = state.selection.$from.node(listItemDepth).type
  if (itemType.name !== 'listItem' && itemType.name !== 'taskItem') return null

  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return null

  const lines = normalizeMultilinePasteLines(text)
  if (lines.length <= 1) return null

  let tr = state.tr
  const { from, to } = state.selection
  if (from !== to) tr = tr.delete(from, to)

  const firstLine = lines[0] ?? ''
  const insertAt = tr.selection.from
  if (firstLine) tr = tr.insertText(firstLine, insertAt, insertAt)

  const $cursor = tr.doc.resolve(tr.selection.from)
  const depth = findListItemDepth($cursor)
  if (depth == null) return null

  let insertPos = $cursor.after(depth)
  let lastInsertedItemStart: number | null = null
  let lastInsertedLine = ''
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const para = paragraph.create(null, line ? state.schema.text(line) : undefined)
    const item = itemType.create(null, para)
    lastInsertedItemStart = insertPos
    lastInsertedLine = line
    tr = tr.insert(insertPos, item)
    insertPos += item.nodeSize
  }

  if (lines.length > 1) {
    const caretPos =
      lastInsertedItemStart != null
        ? lastInsertedItemStart + 2 + lastInsertedLine.length
        : Math.max(1, tr.selection.from)
    tr = tr.setSelection(TextSelection.create(tr.doc, Math.min(caretPos, tr.doc.content.size - 1)))
  } else {
    tr = tr.setSelection(TextSelection.create(tr.doc, Math.max(1, tr.selection.from)))
  }
  return setInputLayerSource(tr.scrollIntoView(), 'paste-list')
}

function findTextblockDepth($from: EditorState['selection']['$from']): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).isTextblock) return depth
  }
  return null
}

/** Multi-line plain text in ordinary paragraphs → one paragraph per line. */
function shouldSplitMultilinePlainTextPaste(state: EditorState): boolean {
  const { from, to } = state.selection
  if (from !== to) return true

  const $from = state.doc.resolve(from)
  if (!$from.parent.isTextblock) return false
  return $from.parent.textContent.trim().length === 0
}

function applyParagraphMultilinePlainTextPaste(state: EditorState, text: string): Transaction | null {
  if (findListItemDepth(state.selection.$from) != null) return null
  if (!shouldSplitMultilinePlainTextPaste(state)) return null

  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return null

  const lines = normalizeMultilinePasteLines(text)
  if (lines.length <= 1) return null

  let tr = state.tr
  const { from, to } = state.selection
  if (from !== to) tr = tr.delete(from, to)

  const firstLine = lines[0] ?? ''
  const insertAt = tr.selection.from
  if (firstLine) tr = tr.insertText(firstLine, insertAt, insertAt)

  const $cursor = tr.doc.resolve(tr.selection.from)
  const textblockDepth = findTextblockDepth($cursor)
  if (textblockDepth == null) return null

  let insertPos = $cursor.after(textblockDepth)
  let lastParaPos: number | null = null
  let lastParaText = ''
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const para = paragraph.create(null, line ? state.schema.text(line) : undefined)
    tr = tr.insert(insertPos, para)
    lastParaPos = insertPos
    lastParaText = line
    insertPos += para.nodeSize
  }

  if (lines.length > 1 && lastParaPos != null) {
    const caretPos = lastParaText
      ? lastParaPos + 1 + lastParaText.length
      : lastParaPos + 1
    tr = tr.setSelection(TextSelection.create(tr.doc, Math.min(caretPos, tr.doc.content.size - 1)))
  } else {
    tr = tr.setSelection(TextSelection.create(tr.doc, Math.max(1, tr.selection.from)))
  }

  return setInputLayerSource(tr.scrollIntoView(), 'paste-multiline')
}

/** Consistent with the menu "Paste as plain text": literal `insertText`, without `insertContent`*/
export function applyPlainTextInsertion(state: EditorState, text: string, source: InputLayerSource): Transaction {
  if (selectionTouchesCodeSpecBlock(state)) {
    return applyCodeSpecPlainTextInsertion(state, text, source)
  }
  const listPaste = source === 'paste' ? applyListMultilinePlainTextPaste(state, text) : null
  if (listPaste) return listPaste
  const paragraphPaste = source === 'paste' ? applyParagraphMultilinePlainTextPaste(state, text) : null
  if (paragraphPaste) return paragraphPaste
  const { from, to } = state.selection
  const normalized = text.replace(/\r\n/g, '\n')
  const slice = buildPlainTextSlice(state.schema, normalized)
  if (slice) {
    return setInputLayerSource(state.tr.replaceSelection(slice), source)
  }
  return setInputLayerSource(state.tr.insertText(normalized, from, to), source)
}

/**
 * Paste plain text: the newline at the end is no longer spelled to the end of the previous line.
 * If the cursor is at the end of a paragraph with existing content and the pasting is with trailing `\n`, first `splitBlock` and then insert the text in the new paragraph (removing the trailing newline).
 */
export function applyPlainTextPasteInsertion(state: EditorState, text: string): Transaction {
  if (selectionTouchesCodeSpecBlock(state)) {
    return applyCodeSpecPlainTextInsertion(state, text, 'paste')
  }
  const { from, to } = state.selection
  const normalized = text.replace(/\r\n/g, '\n')
  const listPaste = applyListMultilinePlainTextPaste(state, normalized)
  if (listPaste) return listPaste
  const paragraphPaste = applyParagraphMultilinePlainTextPaste(state, normalized)
  if (paragraphPaste) return paragraphPaste
  const core = normalized.replace(/\n+$/, '')
  const hadTrailingNewline = core.length < normalized.length

  if (hadTrailingNewline && core.length > 0 && from === to) {
    const $from = state.doc.resolve(from)
    if ($from.parent.isTextblock) {
      const parentHasTextBefore = $from.parentOffset > 0
      const atTextblockEnd = $from.parentOffset === $from.parent.content.size
      if (parentHasTextBefore && atTextblockEnd) {
        let tr = state.tr
        const split = splitBlock(state, (next) => {
          tr = next
        })
        if (split) {
          const pos = tr.selection.from
          tr = tr.insertText(core, pos, pos)
          return setInputLayerSource(tr, 'paste')
        }
      }
    }
  }

  const toInsert = hadTrailingNewline && core.length > 0 ? core : normalized
  return applyPlainTextInsertion(state, toInsert, 'paste')
}

export function clipboardHasImage(event: ClipboardEvent): boolean {
  const cd = event.clipboardData
  if (!cd) return false
  const items = cd.items ? Array.from(cd.items) : []
  if (items.some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return true
  const files = cd.files ? Array.from(cd.files) : []
  return files.some((f) => f.type.startsWith('image/'))
}
