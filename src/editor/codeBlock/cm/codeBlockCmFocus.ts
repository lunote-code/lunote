import { deleteCharBackward, deleteCharForward, selectAll as cmSelectAll } from '@codemirror/commands'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@codemirror/view'

import type { CodeBlockInputPolicy } from '../boundary/codeBlockBoundaryPolicy'
import { isCodeBlockCmEnabled } from './codeBlockCmFeature'
import { suspendPmDomContentEditable } from './codeBlockCmPmFocusLock'
import { runCodeBlockCmEnter } from './codeBlockCmKeyboard'

/** Whether the active element is inside an embedded code-block CodeMirror editor. */
export function isCodeBlockCmFocused(root: Document | ShadowRoot = document): boolean {
  const active = root.activeElement
  if (!(active instanceof HTMLElement)) return false
  return Boolean(
    active.closest(
      '.pm-code-block-cm .cm-editor, .pm-code-block-cm .cm-content, .pm-code-block-cm.cm-editor',
    ),
  )
}

type CmRootHost = HTMLElement & { __lunaCmView?: EditorView }

/** Select all text in the focused embedded code-block CM, if any. */
export function selectAllInFocusedCodeBlockCm(root: Document | ShadowRoot = document): boolean {
  const view = getFocusedCodeBlockCmView(root)
  if (!view) return false
  return cmSelectAll(view)
}

function resolveCodeBlockCmWrap(editor: Editor, blockPos: number): HTMLElement | null {
  try {
    return editor.view.nodeDOM(blockPos) as HTMLElement | null
  } catch {
    return null
  }
}

/** Select all in the CM surface for a PM code block (even when focus detection is flaky). */
export function selectAllInCodeBlockCmAtPos(editor: Editor, blockPos: number): boolean {
  if (!isCodeBlockCmEnabled()) return false
  const focused = getFocusedCodeBlockCmView()
  if (focused && cmSelectAll(focused)) return true
  const wrap = resolveCodeBlockCmWrap(editor, blockPos)
  const view = getCodeBlockCmViewInWrap(wrap)
  if (!view) return false
  focusCodeBlockCmView(view, { pmDom: editor.view.dom })
  return cmSelectAll(view)
}

/** Delete CM range, collapse caret to range start, and restore CM focus. */
export function applyCodeBlockCmCut(view: EditorView, from: number, to: number): void {
  const caret = Math.min(from, to)
  view.dispatch({
    changes: { from, to, insert: '' },
    selection: { anchor: caret, head: caret },
  })
  focusCodeBlockCmView(view)
}

/** Delete CM selection or one character in the given view (ensures focus first). */
export function deleteSelectionInCodeBlockCmView(view: EditorView, forward: boolean): boolean {
  if (!view.hasFocus) focusCodeBlockCmView(view)
  const { from, to } = view.state.selection.main
  if (from !== to) {
    applyCodeBlockCmCut(view, from, to)
    return true
  }
  return forward ? deleteCharForward(view) : deleteCharBackward(view)
}

/** Route Backspace/Delete to the focused embedded CM when PM still owns the key event. */
export function deleteInFocusedCodeBlockCm(forward: boolean, root: Document | ShadowRoot = document): boolean {
  const view = getFocusedCodeBlockCmView(root)
  if (!view) return false
  return deleteSelectionInCodeBlockCmView(view, forward)
}

/** Delete in CM for a PM code block position (when focus detection is flaky). */
export function deleteInCodeBlockCmAtPos(editor: Editor, blockPos: number, forward: boolean): boolean {
  if (!isCodeBlockCmEnabled()) return false
  const wrap = resolveCodeBlockCmWrap(editor, blockPos)
  const view = getCodeBlockCmViewInWrap(wrap)
  if (!view) return false
  focusCodeBlockCmView(view, { pmDom: editor.view.dom })
  return deleteSelectionInCodeBlockCmView(view, forward)
}

/** Best-effort delete in the active CM surface (focused view, PM block pos, or DOM fallback). */
export function deleteInActiveCodeBlockCm(
  editor: Editor,
  policy: Pick<CodeBlockInputPolicy, 'cmFocused' | 'blockPos'>,
  forward: boolean,
): boolean {
  if (deleteInFocusedCodeBlockCm(forward)) return true
  if (policy.blockPos != null && deleteInCodeBlockCmAtPos(editor, policy.blockPos, forward)) return true
  if (!policy.cmFocused) return false
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  const wrap = active.closest('[data-luna-code-block-wrap]') as HTMLElement | null
  const view = getCodeBlockCmViewInWrap(wrap)
  if (!view) return false
  focusCodeBlockCmView(view, { pmDom: editor.view.dom })
  return deleteSelectionInCodeBlockCmView(view, forward)
}

function resolveFocusedCodeBlockCmViewFromDom(root: Document | ShadowRoot = document): EditorView | null {
  const focusedEditor = root.querySelector('.pm-code-block-cm .cm-editor.cm-focused')
  if (!focusedEditor) return null
  const wrap = focusedEditor.closest('[data-luna-code-block-wrap]') as HTMLElement | null
  const fromWrap = getCodeBlockCmViewInWrap(wrap)
  if (fromWrap) return fromWrap
  const cmRoot = focusedEditor.closest('.pm-code-block-cm-root') as CmRootHost | null
  return cmRoot?.__lunaCmView ?? null
}

/** Active embedded code-block CM view, if focus is inside one. */
export function getFocusedCodeBlockCmView(root: Document | ShadowRoot = document): EditorView | null {
  const active = root.activeElement
  if (active instanceof HTMLElement) {
    const wrap = active.closest('[data-luna-code-block-wrap]') as HTMLElement | null
    const fromWrap = getCodeBlockCmViewInWrap(wrap)
    if (fromWrap) return fromWrap
    const cmRoot = active.closest('.pm-code-block-cm-root') as CmRootHost | null
    if (cmRoot?.__lunaCmView) return cmRoot.__lunaCmView
  }
  return resolveFocusedCodeBlockCmViewFromDom(root)
}

/** Resolve the embedded CodeMirror view inside a code block wrap. */
export function getCodeBlockCmViewInWrap(wrap: HTMLElement | null): EditorView | null {
  if (!wrap) return null
  const root = wrap.querySelector('.pm-code-block-cm-root') as CmRootHost | null
  return root?.__lunaCmView ?? null
}

export type FocusCodeBlockCmOpts = {
  /** Blur PM root first — required when ProseMirror still owns focus (WebKit). */
  pmDom?: HTMLElement | null
}

function releaseProseMirrorFocus(pmDom?: HTMLElement | null): void {
  if (!pmDom) return
  const active = document.activeElement
  if (active instanceof HTMLElement && pmDom.contains(active)) {
    active.blur()
  }
}

/** Focus CM after suspending PM dom (WebKit nested contenteditable). PM restore happens on unlock only. */
export function focusCodeBlockCmView(view: EditorView, opts?: FocusCodeBlockCmOpts): boolean {
  const pmDom = opts?.pmDom ?? null
  if (pmDom instanceof HTMLElement) {
    suspendPmDomContentEditable(pmDom)
    releaseProseMirrorFocus(pmDom)
  }
  view.contentDOM.focus({ preventScroll: true })
  if (!view.hasFocus) view.focus()
  if (!view.hasFocus && pmDom instanceof HTMLElement) {
    releaseProseMirrorFocus(pmDom)
    view.contentDOM.focus({ preventScroll: true })
    if (!view.hasFocus) view.focus()
  }
  return view.hasFocus
}

/** Defer CM focus until after pointer/PM handlers complete (Safari nested contenteditable). */
export function scheduleFocusCodeBlockCmView(view: EditorView, opts?: FocusCodeBlockCmOpts): void {
  const run = () => focusCodeBlockCmView(view, opts)
  if (view.contentDOM.getClientRects().length === 0) {
    requestAnimationFrame(run)
    return
  }
  requestAnimationFrame(() => {
    queueMicrotask(run)
  })
}

/** Focus the CodeMirror view inside a code block wrap, if present. */
export function focusCodeBlockCmInWrap(wrap: HTMLElement | null, opts?: FocusCodeBlockCmOpts): boolean {
  const view = getCodeBlockCmViewInWrap(wrap)
  if (view) return focusCodeBlockCmView(view, opts)
  const content = wrap?.querySelector('.pm-code-block-cm .cm-content') as HTMLElement | null
  if (!content) return false
  content.focus({ preventScroll: true })
  return document.activeElement === content
}

/** Run Enter in the embedded CM for a wrap (focus first if needed). */
export function runEnterInCodeBlockCmWrap(wrap: HTMLElement | null, tabSize = 4): boolean {
  const view = getCodeBlockCmViewInWrap(wrap)
  if (!view) return false
  if (!view.hasFocus) view.focus()
  return runCodeBlockCmEnter(view, tabSize)
}

/** Retry Enter until CM mounts (NodeView may still be rendering). */
export function runEnterInCodeBlockCmWrapWhenReady(wrap: HTMLElement | null, tabSize = 4, attempt = 0): void {
  if (!wrap) return
  if (runEnterInCodeBlockCmWrap(wrap, tabSize)) return
  if (attempt >= 12) return
  requestAnimationFrame(() => runEnterInCodeBlockCmWrapWhenReady(wrap, tabSize, attempt + 1))
}
