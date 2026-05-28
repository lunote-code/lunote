import { Extension, type Editor } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { codeBlockNodeAt } from './codeBlockSelection'
import { isPosInsideCodeSpecBlock } from './lunaCodeContext'

/** The starting position of the `codeBlock` node in the document where the current selection is located (`nodeBefore` side)*/
export function codeBlockStartDocPos($from: ResolvedPos): number | null {
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === 'codeBlock') return $from.before(d)
  }
  return null
}

function codeBlockText($pos: ResolvedPos): string {
  return $pos.parent.textBetween(0, $pos.parent.content.size, '\n', '\n')
}

/** The cursor is on the first line of the code block, at the beginning of the line (offset 0)*/
export function isAtCodeBlockFirstLineStart($from: ResolvedPos): boolean {
  if ($from.parent.type.name !== 'codeBlock') return false
  return $from.parentOffset === 0
}

/** The cursor is at the end of the last line of the code block (end of text)*/
export function isAtCodeBlockLastLineEnd($from: ResolvedPos): boolean {
  if ($from.parent.type.name !== 'codeBlock') return false
  const text = codeBlockText($from)
  return $from.parentOffset === text.length
}

export function focusCodeBlockLangInput(view: EditorView, blockDocPos: number): boolean {
  if (blockDocPos < 0 || blockDocPos > view.state.doc.content.size) return false
  let chip: HTMLButtonElement | null = null
  try {
    const el = view.nodeDOM(blockDocPos) as HTMLElement | null
    chip = el?.querySelector?.('.pm-code-lang-chip') as HTMLButtonElement | null
  } catch {
    return false
  }
  if (!chip) return false
  chip.focus({ preventScroll: false })
  queueMicrotask(() => {
    try {
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } catch {
      /* ignore */
    }
  })
  return true
}

/** Leaving the code block: the cursor enters the next editable position*/
export function exitCodeBlockForward(editor: Editor, blockStart: number): boolean {
  const { state } = editor
  const { doc } = state
  const node = codeBlockNodeAt(editor, blockStart)
  if (!node) return false
  const after = blockStart + node.nodeSize
  if (after > doc.content.size) return false
  let $after
  try {
    $after = doc.resolve(after)
  } catch {
    return false
  }
  const found = Selection.findFrom($after, 1, true)
  if (found) {
    const tr = state.tr.setSelection(found).scrollIntoView()
    editor.view.dispatch(tr)
    editor.view.focus()
    return true
  }
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return false
  const tr = state.tr.insert(after, paragraph.create())
  const focusPos = Math.min(after + 1, tr.doc.content.size)
  const inserted = Selection.findFrom(tr.doc.resolve(focusPos), 1, true)
  if (!inserted) return false
  tr.setSelection(inserted).scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/** Leaving a code block: the cursor returns to near the end of the previous block*/
export function exitCodeBlockBackward(editor: Editor, blockStart: number): boolean {
  if (blockStart <= 0 || !codeBlockNodeAt(editor, blockStart)) return false
  const { state } = editor
  const { doc } = state
  let $at
  try {
    $at = doc.resolve(blockStart)
  } catch {
    return false
  }
  const sel = Selection.near($at, -1)
  const tr = state.tr.setSelection(sel).scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/**
 * Code block boundary keyboard navigation (VSCode/Typora style):
 * - The first row and column ↑ → focus on the language box; the language box then ↑ → leaves to the previous block
 * - The end of the last line ↓ → focuses the language box; the language box then ↓ → leaves to the next block
 */
export const LunaCodeBlockNav = Extension.create({
  name: 'lunaCodeBlockNav',

  priority: 2050,

  addKeyboardShortcuts() {
    return {
      ArrowUp: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty || !isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        if (!isAtCodeBlockFirstLineStart($from)) return false
        const start = codeBlockStartDocPos($from)
        if (start == null) return false
        if (focusCodeBlockLangInput(editor.view, start)) return true
        return false
      },

      ArrowDown: ({ editor }) => {
        if (editor.view.composing) return false
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty || !isPosInsideCodeSpecBlock($from)) return false
        if ($from.parent.type.name !== 'codeBlock') return false
        if (!isAtCodeBlockLastLineEnd($from)) return false
        const start = codeBlockStartDocPos($from)
        if (start == null) return false
        if (focusCodeBlockLangInput(editor.view, start)) return true
        return false
      },
    }
  },
})
