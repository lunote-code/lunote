import type { Editor } from '@tiptap/core'

import {
  exitAllCodeBlockEditingForView,
  flushAllCodeBlockSessionsForView,
} from '../boundary/codeBlockSessionRegistry'
import { getCodeBlockCmViewInWrap, isCodeBlockCmFocused } from './codeBlockCmFocus'
import {
  isPmDomSuspendedForCodeBlockCm,
  isPmLockedForCodeBlockCm,
  unlockPmForCodeBlockCm,
} from './codeBlockCmPmFocusLock'

type CmRootHost = HTMLElement & { __lunaCmView?: import('@codemirror/view').EditorView }

function resolveCodeBlockCmViewFromEditorEl(cmEditorEl: HTMLElement) {
  const wrap = cmEditorEl.closest('[data-luna-code-block-wrap]') as HTMLElement | null
  const fromWrap = getCodeBlockCmViewInWrap(wrap)
  if (fromWrap) return fromWrap
  const cmRoot = cmEditorEl.closest('.pm-code-block-cm-root') as CmRootHost | null
  return cmRoot?.__lunaCmView ?? null
}

/** Drop stale `.cm-focused` when browser focus already left (scroll / outside-click races). */
function releaseStaleCodeBlockCmEditorEl(cmEditorEl: HTMLElement): void {
  if (cmEditorEl.matches(':focus-within')) return

  const active = document.activeElement
  if (active instanceof HTMLElement && cmEditorEl.contains(active)) {
    active.blur()
    return
  }

  const cmView = resolveCodeBlockCmViewFromEditorEl(cmEditorEl)
  if (!cmView) {
    cmEditorEl.classList.remove('cm-focused')
    return
  }

  if (cmView.root.activeElement === cmView.contentDOM) {
    cmView.contentDOM.blur()
    return
  }

  // CM missed focusout when the block scrolled off-screen; force a DOM refresh.
  if (!cmView.hasFocus) {
    cmView.update([])
  }
}

function blurStaleCodeBlockCmEditors(pmDom: HTMLElement): void {
  for (const el of pmDom.querySelectorAll('.pm-code-block-cm .cm-editor.cm-focused')) {
    if (el instanceof HTMLElement) releaseStaleCodeBlockCmEditorEl(el)
  }
}

/** CM still shows `.cm-focused` chrome without a real `:focus-within` (save / scroll / blur races). */
export function hasStaleCodeBlockCmFocusedChrome(pmDom: HTMLElement): boolean {
  return Boolean(
    pmDom.querySelector('.pm-code-block-cm .cm-editor.cm-focused:not(:focus-within)'),
  )
}

export function needsCodeBlockCmOutsideClickRelease(pmDom: HTMLElement, editor: Editor): boolean {
  if (isPmDomSuspendedForCodeBlockCm(pmDom)) return true
  if (isCodeBlockCmFocused()) return true
  if (isPmLockedForCodeBlockCm(editor)) return true
  return hasStaleCodeBlockCmFocusedChrome(pmDom)
}

/**
 * After CM→PM flush (save / serialize), drop stale CM chrome and restore PM editing
 * when focus already left the embedded editor.
 */
export function reconcileCodeBlockCmFocusAfterSerialize(editor: Editor): void {
  if (editor.isDestroyed) return
  const view = editor.view
  const pmDom = view?.dom
  if (!(pmDom instanceof HTMLElement)) return
  if (isCodeBlockCmFocused()) return

  exitAllCodeBlockEditingForView(view)
  blurStaleCodeBlockCmEditors(pmDom)

  if (isPmDomSuspendedForCodeBlockCm(pmDom) || isPmLockedForCodeBlockCm(editor)) {
    unlockPmForCodeBlockCm(editor)
  }
}

/** Shared outside-click release: flush CM, exit editing, blur CM, unlock PM. */
export function releaseCodeBlockCmForOutsidePointer(editor: Editor, pmDom: HTMLElement): void {
  if (editor.isDestroyed) {
    pmDom.setAttribute('contenteditable', 'true')
    return
  }
  const view = editor.view
  flushAllCodeBlockSessionsForView(view)
  exitAllCodeBlockEditingForView(view)
  blurStaleCodeBlockCmEditors(pmDom)
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest('.pm-code-block-cm')) {
    active.blur()
  }
  unlockPmForCodeBlockCm(editor)
}
