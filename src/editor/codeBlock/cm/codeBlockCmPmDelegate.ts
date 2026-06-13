import type { Editor } from '@tiptap/core'
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

import { acquireCodeBlockCmFocus } from './codeBlockCmInputFocus'
import { getCodeBlockCmViewInWrap } from './codeBlockCmFocus'
import { findAdjacentCodeBlockPos } from '../../lunaBlockVerticalNavUtils'
import { requestCodeBlockCmEdit } from '../boundary/codeBlockBoundaryActions'
import { prepareCodeBlockCmFocusTransfer } from './codeBlockCmPmFocusReconcile'

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

function codeBlockPosAfterTextblock(view: PmEditorView, $from: ResolvedPos): number | null {
  return findAdjacentCodeBlockPos($from, 'down', view)
}

function codeBlockPosBeforeTextblock(view: PmEditorView, $from: ResolvedPos): number | null {
  return findAdjacentCodeBlockPos($from, 'up', view)
}

function prepareKeyboardCmFocusTransfer(editor: Editor | null | undefined, wrap: HTMLElement): void {
  if (!editor) return
  prepareCodeBlockCmFocusTransfer(editor, wrap)
}

const MAX_KEYBOARD_CM_FOCUS_ATTEMPTS = 24

function focusCmInWrapAtOffset(
  wrap: HTMLElement,
  offset: number,
  editor?: Editor | null,
  attempt = 0,
): boolean {
  prepareKeyboardCmFocusTransfer(editor, wrap)
  requestCodeBlockCmEdit(wrap)
  const cmView = getCodeBlockCmViewInWrap(wrap)
  if (!cmView) {
    if (attempt < MAX_KEYBOARD_CM_FOCUS_ATTEMPTS) {
      requestAnimationFrame(() => focusCmInWrapAtOffset(wrap, offset, editor, attempt + 1))
    }
    // Claim the key so PM does not leave an invisible mirror caret while CM mounts.
    return true
  }
  const pos = Math.max(0, Math.min(offset, cmView.state.doc.length))
  cmView.dispatch({ selection: { anchor: pos, head: pos } })
  const pmDom = editor?.view.dom ?? null
  if (pmDom instanceof HTMLElement) pmDom.blur()
  const focused = acquireCodeBlockCmFocus(cmView, { pmDom, wrap })
  if (!focused && attempt < MAX_KEYBOARD_CM_FOCUS_ATTEMPTS) {
    requestAnimationFrame(() => focusCmInWrapAtOffset(wrap, offset, editor, attempt + 1))
  }
  return true
}

/** Keyboard / exit path: focus embedded CM at a code-block doc position (offset 0 = first line). */
export function enterCodeBlockCmAtDocPos(
  editor: Editor,
  blockPos: number,
  offset: number,
): boolean {
  if (editor.isDestroyed) return false
  const view = editor.view
  let wrap: HTMLElement
  try {
    wrap = view.nodeDOM(blockPos) as HTMLElement
  } catch {
    return false
  }
  if (!wrap) return false
  prepareCodeBlockCmFocusTransfer(editor, wrap)
  return focusCmInWrapAtOffset(wrap, offset, editor)
}

/** PM ArrowDown/Up at block boundary: enter embedded CM instead of leaving a PM caret in the gutter. */
export function tryEnterCodeBlockCmOnBoundaryArrow(
  view: PmEditorView,
  key: 'ArrowDown' | 'ArrowUp',
  editor?: Editor | null,
): boolean {
  const { $from } = view.state.selection
  if (!view.state.selection.empty) return false
  const blockPos =
    key === 'ArrowDown'
      ? codeBlockPosAfterTextblock(view, $from)
      : codeBlockPosBeforeTextblock(view, $from)
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
  return focusCmInWrapAtOffset(wrap, offset, editor)
}

/** Route navigation keys to CM when PM selection is inside a code block but CM is not focused. */
export function delegateCodeBlockCmNavigationKey(
  wrap: HTMLElement,
  key: string,
  pmOffset: number,
  pmDom?: HTMLElement | null,
  editor?: Editor | null,
): boolean {
  if (!NAVIGATION_KEYS.has(key)) return false
  prepareKeyboardCmFocusTransfer(editor, wrap)
  requestCodeBlockCmEdit(wrap)
  const cmView = getCodeBlockCmViewInWrap(wrap)
  if (!cmView) return false
  const pos = Math.max(0, Math.min(pmOffset, cmView.state.doc.length))
  if (cmView.state.selection.main.head !== pos) {
    cmView.dispatch({ selection: { anchor: pos, head: pos } })
  }
  if (pmDom instanceof HTMLElement) pmDom.blur()
  if (!acquireCodeBlockCmFocus(cmView, { pmDom, wrap })) return false
  return runCmNavigationKey(cmView, key)
}
