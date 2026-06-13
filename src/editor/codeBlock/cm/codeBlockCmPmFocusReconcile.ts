import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

import {
  exitAllCodeBlockEditingForView,
  exitOtherCodeBlockEditingForView,
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

/** Drop stale `.cm-focused` when browser focus already left (scroll / save races). */
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

/** Outside-click release: CM may still show `:focus-within` after off-screen paste/scroll. */
function forceReleaseCodeBlockCmEditorEl(cmEditorEl: HTMLElement): void {
  const cmView = resolveCodeBlockCmViewFromEditorEl(cmEditorEl)
  if (cmView) {
    if (cmView.hasFocus || cmView.root.activeElement === cmView.contentDOM) {
      cmView.contentDOM.blur()
    }
    const staleChrome =
      cmEditorEl.classList.contains('cm-focused') && !cmEditorEl.matches(':focus-within')
    if (staleChrome && !cmView.hasFocus) {
      cmView.update([])
    }
  }

  const active = document.activeElement
  if (active instanceof HTMLElement && cmEditorEl.contains(active)) {
    active.blur()
  }

  if (cmEditorEl.classList.contains('cm-focused')) {
    cmEditorEl.classList.remove('cm-focused')
  }
}

function blurStaleCodeBlockCmEditors(pmDom: HTMLElement): void {
  for (const el of pmDom.querySelectorAll('.pm-code-block-cm .cm-editor.cm-focused')) {
    if (el instanceof HTMLElement) releaseStaleCodeBlockCmEditorEl(el)
  }
}

function forceBlurCodeBlockCmEditors(pmDom: HTMLElement): void {
  for (const el of pmDom.querySelectorAll('.pm-code-block-cm .cm-editor')) {
    if (!(el instanceof HTMLElement)) continue
    if (!el.classList.contains('cm-focused') && !el.matches(':focus-within')) continue
    forceReleaseCodeBlockCmEditorEl(el)
  }
}

function forceBlurCodeBlockCmEditorsExcept(pmDom: HTMLElement, activeWrap: HTMLElement | null | undefined): void {
  for (const el of pmDom.querySelectorAll('.pm-code-block-cm .cm-editor')) {
    if (!(el instanceof HTMLElement)) continue
    if (activeWrap?.contains(el)) continue
    if (!el.classList.contains('cm-focused') && !el.matches(':focus-within')) continue
    forceReleaseCodeBlockCmEditorEl(el)
  }
}

const recentOutsideReleaseByView = new WeakMap<EditorView, number>()

export function markCodeBlockCmOutsidePointerRelease(view: EditorView): void {
  recentOutsideReleaseByView.set(view, Date.now())
}

/** Blur from releaseCodeBlockCmForOutsidePointer already flushed — skip duplicate blur work. */
export function consumeRecentCodeBlockCmOutsidePointerRelease(
  view: EditorView,
  withinMs = 120,
): boolean {
  const at = recentOutsideReleaseByView.get(view)
  if (at == null) return false
  if (Date.now() - at > withinMs) {
    recentOutsideReleaseByView.delete(view)
    return false
  }
  recentOutsideReleaseByView.delete(view)
  return true
}

export function hasOtherCodeBlockCmActivity(
  pmDom: HTMLElement,
  activeWrap: HTMLElement,
): boolean {
  for (const el of pmDom.querySelectorAll('.pm-code-block-cm .cm-editor')) {
    if (!(el instanceof HTMLElement)) continue
    if (activeWrap.contains(el)) continue
    if (el.classList.contains('cm-focused') || el.matches(':focus-within')) return true
  }
  return false
}

/**
 * Switching between embedded code blocks: exit stale sessions and drop off-screen CM chrome
 * before the newly clicked block enters editing.
 */
export function prepareCodeBlockCmFocusTransfer(editor: Editor, activeWrap: HTMLElement): void {
  if (editor.isDestroyed) return
  const view = editor.view
  const pmDom = view?.dom
  if (!(pmDom instanceof HTMLElement)) return
  exitOtherCodeBlockEditingForView(view, activeWrap)
  forceBlurCodeBlockCmEditorsExcept(pmDom, activeWrap)
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

/** Shared outside-click release: flush CM, blur CM, unlock PM — keep sessions mounted for fast re-focus. */
export function releaseCodeBlockCmForOutsidePointer(editor: Editor, pmDom: HTMLElement): void {
  if (editor.isDestroyed) {
    pmDom.setAttribute('contenteditable', 'true')
    return
  }
  const view = editor.view
  markCodeBlockCmOutsidePointerRelease(view)
  flushAllCodeBlockSessionsForView(view)
  forceBlurCodeBlockCmEditors(pmDom)
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest('.pm-code-block-cm')) {
    active.blur()
  }
  unlockPmForCodeBlockCm(editor)
}
