import type { EditorState } from '@tiptap/pm/state'
import type { ResolvedPos } from '@tiptap/pm/model'

/** Whether there is a block node of `spec.code` (such as `codeBlock`) on the ancestor chain where the cursor is located*/
export function isPosInsideCodeSpecBlock($pos: ResolvedPos): boolean {
  for (let d = $pos.depth; d > 0; d -= 1) {
    if ($pos.node(d).type.spec.code) return true
  }
  return false
}

/** Either end of the selection falls within the "Code Block Class" node (fence code, etc.)*/
export function selectionTouchesCodeSpecBlock(state: EditorState): boolean {
  const { from, to } = state.selection
  const doc = state.doc
  const max = Math.max(1, doc.content.size)
  const head = Math.min(Math.max(from, 1), max)
  const anchor = Math.min(Math.max(to, 1), max)
  return isPosInsideCodeSpecBlock(doc.resolve(head)) || isPosInsideCodeSpecBlock(doc.resolve(anchor))
}

/** Whether the inline `code` mark (`spec.code`) acts on the selection endpoint*/
export function selectionTouchesInlineCodeMark(state: EditorState): boolean {
  const { $from, $to } = state.selection
  const fromMarks = $from.marks()
  const toMarks = $to.marks()
  const isCodeMark = (m: { type: { spec: Record<string, unknown> } }) => Boolean(m.type.spec.code)
  return fromMarks.some(isCodeMark) || toMarks.some(isCodeMark)
}

/** Whether the cursor is in an inline code mark (including storedMarks) and not within a fenced code block*/
export function isInlineCodeMarkActive(state: EditorState): boolean {
  const { $from } = state.selection
  if (isPosInsideCodeSpecBlock($from)) return false
  const codeMark = state.schema.marks.code
  if (!codeMark) return false
  if (state.storedMarks?.some((m) => m.type === codeMark)) return true
  return $from.marks().some((m) => m.type === codeMark)
}

/**
 * Markdown block-level transformations, table commands, header shortcuts, etc. should be disabled:
 * - Fence code blocks (`codeBlock` and other `spec.code` blocks)
 * - or inline code mark to cover the selection endpoints
 */
export function isCodeEditGuardActive(state: EditorState): boolean {
  return selectionTouchesCodeSpecBlock(state) || selectionTouchesInlineCodeMark(state)
}
