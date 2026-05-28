import { Fragment, Slice, type Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorState, Transaction } from 'prosemirror-state'
import { splitBlock } from 'prosemirror-commands'

/** Transaction meta: mark input source (paste/menu paste/typing)*/
export const INPUT_LAYER_SOURCE_META = 'inputLayerSource'

export type InputLayerSource = 'paste' | 'paste-rich' | 'typing' | 'command'

export function isPasteLayerSource(source: InputLayerSource | undefined): boolean {
  return source === 'paste' || source === 'paste-rich'
}

export function setInputLayerSource(tr: Transaction, source: InputLayerSource): Transaction {
  return tr.setMeta(INPUT_LAYER_SOURCE_META, source)
}

export function getInputLayerSource(tr: Transaction): InputLayerSource | undefined {
  return tr.getMeta(INPUT_LAYER_SOURCE_META) as InputLayerSource | undefined
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

/** Consistent with the menu "Paste as plain text": literal `insertText`, without `insertContent`*/
export function applyPlainTextInsertion(state: EditorState, text: string, source: InputLayerSource): Transaction {
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
  const { from, to } = state.selection
  const normalized = text.replace(/\r\n/g, '\n')
  if (normalized.includes('\n') && state.schema.nodes.hardBreak) {
    return applyPlainTextInsertion(state, normalized, 'paste')
  }
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
          return setInputLayerSource(tr.scrollIntoView(), 'paste')
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
