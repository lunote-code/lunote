import type { Editor } from '@tiptap/core'

import {
  focusCodeBlockCmInWrap,
  getCodeBlockCmViewInWrap,
  runEnterInCodeBlockCmWrapWhenReady,
} from '../cm/codeBlockCmFocus'
import { focusCodeBlockLangInput } from '../behavior/nav'

/** Request CM edit mode on a code-block wrap, then run `fn` when CM is ready. */
export function requestCodeBlockCmEdit(
  wrap: HTMLElement,
  fn?: (wrap: HTMLElement) => void,
): void {
  wrap.dispatchEvent(new CustomEvent('luna-code-block-request-edit', { bubbles: false }))
  focusCodeBlockCmInWrap(wrap)
  if (!fn) return
  queueMicrotask(() => fn(wrap))
}

export function delegateEnterToCodeBlockCm(editor: Editor, blockPos: number): boolean {
  try {
    const wrap = editor.view.nodeDOM(blockPos) as HTMLElement | null
    if (!wrap) return false
    requestCodeBlockCmEdit(wrap, (el) => {
      runEnterInCodeBlockCmWrapWhenReady(el)
    })
    return true
  } catch {
    return false
  }
}

export function focusCodeBlockCmAtPos(editor: Editor, blockPos: number): boolean {
  try {
    const wrap = editor.view.nodeDOM(blockPos) as HTMLElement | null
    if (!wrap) return false
    focusCodeBlockCmInWrap(wrap)
    return true
  } catch {
    return false
  }
}

export function redirectFoldedCodeBlockKeyboard(editor: Editor, blockPos: number): boolean {
  return focusCodeBlockLangInput(editor.view, blockPos)
}

export function insertTextIntoCodeBlockCm(wrap: HTMLElement, text: string): void {
  wrap.dispatchEvent(new CustomEvent('luna-code-block-request-edit', { bubbles: false }))
  const insertIntoCm = (attempt = 0) => {
    focusCodeBlockCmInWrap(wrap)
    const cmView = getCodeBlockCmViewInWrap(wrap)
    if (!cmView) {
      if (attempt < 12) requestAnimationFrame(() => insertIntoCm(attempt + 1))
      return
    }
    const { from, to } = cmView.state.selection.main
    cmView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
  }
  insertIntoCm()
}
