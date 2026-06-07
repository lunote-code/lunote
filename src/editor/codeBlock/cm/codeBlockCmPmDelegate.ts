import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineEnd,
  cursorLineStart,
  cursorLineUp,
} from '@codemirror/commands'
import type { ResolvedPos } from '@tiptap/pm/model'
import type { EditorView as PmEditorView } from '@tiptap/pm/view'
import type { EditorView as CmEditorView } from '@codemirror/view'

import { focusCodeBlockCmInWrap, getCodeBlockCmViewInWrap } from './codeBlockCmFocus'
import { requestCodeBlockCmEdit } from '../boundary/codeBlockBoundaryActions'

const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
])

function runCmNavigationKey(cmView: CmEditorView, key: string): boolean {
  switch (key) {
    case 'ArrowDown':
      return cursorLineDown(cmView)
    case 'ArrowUp':
      return cursorLineUp(cmView)
    case 'ArrowLeft':
      return cursorCharLeft(cmView)
    case 'ArrowRight':
      return cursorCharRight(cmView)
    case 'Home':
      return cursorLineStart(cmView)
    case 'End':
      return cursorLineEnd(cmView)
    default:
      return false
  }
}

function codeBlockPosAfterTextblock($from: ResolvedPos): number | null {
  if (!$from.parent.type.isTextblock) return null
  if ($from.parentOffset !== $from.parent.content.size) return null
  const $after = $from.doc.resolve($from.after($from.depth))
  const nodeAfter = $after.nodeAfter
  if (!nodeAfter || nodeAfter.type.name !== 'codeBlock') return null
  return $after.pos
}

function codeBlockPosBeforeTextblock($from: ResolvedPos): number | null {
  if (!$from.parent.type.isTextblock) return null
  if ($from.parentOffset !== 0) return null
  const $before = $from.doc.resolve($from.before($from.depth))
  const nodeBefore = $before.nodeBefore
  if (!nodeBefore || nodeBefore.type.name !== 'codeBlock') return null
  return $before.pos - nodeBefore.nodeSize
}

function focusCmInWrapAtOffset(
  wrap: HTMLElement,
  offset: number,
  pmDom?: HTMLElement | null,
  attempt = 0,
): boolean {
  requestCodeBlockCmEdit(wrap)
  const cmView = getCodeBlockCmViewInWrap(wrap)
  if (!cmView) {
    if (attempt < 12) {
      requestAnimationFrame(() => focusCmInWrapAtOffset(wrap, offset, pmDom, attempt + 1))
    }
    return false
  }
  const pos = Math.max(0, Math.min(offset, cmView.state.doc.length))
  cmView.dispatch({ selection: { anchor: pos, head: pos } })
  pmDom?.blur()
  focusCodeBlockCmInWrap(wrap, { pmDom })
  return cmView.hasFocus
}

/** PM ArrowDown/Up at block boundary: enter embedded CM instead of leaving a PM caret in the gutter. */
export function tryEnterCodeBlockCmOnBoundaryArrow(
  view: PmEditorView,
  key: 'ArrowDown' | 'ArrowUp',
): boolean {
  const { $from } = view.state.selection
  if (!view.state.selection.empty) return false
  const blockPos =
    key === 'ArrowDown'
      ? codeBlockPosAfterTextblock($from)
      : codeBlockPosBeforeTextblock($from)
  if (blockPos == null) return false

  let wrap: HTMLElement
  try {
    wrap = view.nodeDOM(blockPos) as HTMLElement
  } catch {
    return false
  }
  if (!wrap) return false

  const blockNode = view.state.doc.nodeAt(blockPos)
  const offset =
    key === 'ArrowDown' ? 0 : Math.max(0, blockNode?.textContent.length ?? 0)
  return focusCmInWrapAtOffset(wrap, offset, view.dom)
}

/** Route navigation keys to CM when PM selection is inside a code block but CM is not focused. */
export function delegateCodeBlockCmNavigationKey(
  wrap: HTMLElement,
  key: string,
  pmOffset: number,
  pmDom?: HTMLElement | null,
): boolean {
  if (!NAVIGATION_KEYS.has(key)) return false
  requestCodeBlockCmEdit(wrap)
  const cmView = getCodeBlockCmViewInWrap(wrap)
  if (!cmView) return false
  const pos = Math.max(0, Math.min(pmOffset, cmView.state.doc.length))
  if (cmView.state.selection.main.head !== pos) {
    cmView.dispatch({ selection: { anchor: pos, head: pos } })
  }
  pmDom?.blur()
  focusCodeBlockCmInWrap(wrap, { pmDom })
  return runCmNavigationKey(cmView, key)
}
