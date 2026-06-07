import { Extension, type Editor } from '@tiptap/core'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { Selection, TextSelection, type EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { isPosInsideCodeSpecBlock } from './lunaCodeContext'

type CaretNavTarget = 'lineStart' | 'lineEnd' | 'docStart' | 'docEnd'

function selectionHead(state: EditorState): number {
  const sel = state.selection
  if (sel instanceof TextSelection) return sel.head
  return sel.from
}

function clampPos(doc: PMNode, pos: number): number {
  return Math.max(0, Math.min(pos, doc.content.size))
}

function findLineBoundary(view: EditorView, pos: number, side: 'start' | 'end'): number {
  const doc = view.state.doc
  const clamped = clampPos(doc, pos)
  const $pos = doc.resolve(clamped)
  const blockStart = $pos.start()
  const blockEnd = $pos.end()
  if (blockStart >= blockEnd) return clamped

  let lineTop: number
  let lineBottom: number
  try {
    const coords = view.coordsAtPos(clamped)
    lineTop = coords.top
    lineBottom = coords.bottom
  } catch {
    return side === 'start' ? blockStart : blockEnd
  }

  const sameLine = (candidate: number): boolean => {
    try {
      const coords = view.coordsAtPos(candidate)
      return Math.abs(coords.top - lineTop) < 1 && Math.abs(coords.bottom - lineBottom) < 1
    } catch {
      return false
    }
  }

  if (side === 'start') {
    let lo = blockStart
    let hi = clamped
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (sameLine(mid)) hi = mid
      else lo = mid + 1
    }
    return lo
  }

  let lo = clamped
  let hi = blockEnd
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (sameLine(mid)) lo = mid
    else hi = mid - 1
  }
  return lo
}

function docBoundaryPos(doc: PMNode, side: 'start' | 'end'): number {
  return side === 'start' ? Selection.atStart(doc).from : Selection.atEnd(doc).to
}

function codeBlockContentBoundaryPos($pos: ResolvedPos, side: 'start' | 'end'): number | null {
  if ($pos.parent.type.name !== 'codeBlock') return null
  return side === 'start' ? $pos.start() : $pos.end()
}

function resolveCaretNavTarget(view: EditorView, head: number, target: CaretNavTarget): number {
  const $head = view.state.doc.resolve(clampPos(view.state.doc, head))
  if (
    (target === 'docStart' || target === 'docEnd') &&
    isPosInsideCodeSpecBlock($head) &&
    $head.parent.type.name === 'codeBlock'
  ) {
    const blockBound = codeBlockContentBoundaryPos($head, target === 'docStart' ? 'start' : 'end')
    if (blockBound != null) return blockBound
  }

  switch (target) {
    case 'lineStart':
      return findLineBoundary(view, head, 'start')
    case 'lineEnd':
      return findLineBoundary(view, head, 'end')
    case 'docStart':
      return docBoundaryPos(view.state.doc, 'start')
    case 'docEnd':
      return docBoundaryPos(view.state.doc, 'end')
  }
}

function moveCaret(editor: Editor, target: CaretNavTarget, extend: boolean): boolean {
  if (editor.view.composing) return false
  const { state } = editor
  const head = selectionHead(state)
  const nextPos = resolveCaretNavTarget(editor.view, head, target)
  const anchor = extend ? state.selection.anchor : nextPos
  const tr = state.tr
    .setSelection(TextSelection.create(state.doc, anchor, nextPos))
    .scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}

/**
 * Visual editor caret navigation aligned with CodeMirror defaults on macOS:
 * Mod+←/→ line start/end; Mod+↑/↓ document start/end (Shift extends selection).
 * Inside fenced code blocks, Mod+↑/↓ moves to block content start/end instead of the whole document.
 */
export const LunaEditorCaretNav = Extension.create({
  name: 'lunaEditorCaretNav',

  priority: 2060,

  addKeyboardShortcuts() {
    const bind = (target: CaretNavTarget, extend = false) => () => moveCaret(this.editor, target, extend)
    return {
      'Mod-ArrowLeft': bind('lineStart'),
      'Mod-ArrowRight': bind('lineEnd'),
      'Mod-ArrowUp': bind('docStart'),
      'Mod-ArrowDown': bind('docEnd'),
      'Shift-Mod-ArrowLeft': bind('lineStart', true),
      'Shift-Mod-ArrowRight': bind('lineEnd', true),
      'Shift-Mod-ArrowUp': bind('docStart', true),
      'Shift-Mod-ArrowDown': bind('docEnd', true),
    }
  },
})
