import type { EditorView } from '@codemirror/view'

import { isCodeBlockCmMouseTarget } from './codeBlockCmDom'
import { applyCodeBlockCmCut, focusCodeBlockCmView } from './codeBlockCmFocus'
import {
  codeBlockCmPaste,
  codeBlockCmSelectedText,
  syncWriteClipboardText,
} from './codeBlockContextMenuActions'

/** Sync copy for native `copy` events (Cmd+C). */
export function handleCodeBlockCmCopyEvent(event: ClipboardEvent, view: EditorView): boolean {
  const text = codeBlockCmSelectedText(view)
  if (!text) return false
  event.preventDefault()
  event.stopPropagation()
  event.clipboardData?.setData('text/plain', text)
  return true
}

/** Sync cut for native `cut` events (Cmd+X). */
export function handleCodeBlockCmCutEvent(event: ClipboardEvent, view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  const text = view.state.sliceDoc(from, to)
  event.preventDefault()
  event.stopPropagation()
  event.clipboardData?.setData('text/plain', text)
  applyCodeBlockCmCut(view, from, to)
  return true
}

export function runCodeBlockCmCopyKeymap(view: EditorView): boolean {
  const text = codeBlockCmSelectedText(view)
  if (!text) return false
  focusCodeBlockCmView(view)
  if (document.execCommand('copy')) {
    focusCodeBlockCmView(view)
    return true
  }
  if (!syncWriteClipboardText(text)) return false
  focusCodeBlockCmView(view)
  return true
}

export function runCodeBlockCmCutKeymap(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  focusCodeBlockCmView(view)
  const docLenBefore = view.state.doc.length
  if (document.execCommand('cut')) {
    if (view.state.doc.length < docLenBefore) {
      const caret = Math.min(view.state.selection.main.anchor, view.state.doc.length)
      if (view.state.selection.main.from !== caret || view.state.selection.main.to !== caret) {
        view.dispatch({ selection: { anchor: caret, head: caret } })
      }
      focusCodeBlockCmView(view)
      return true
    }
  }
  const text = view.state.sliceDoc(from, to)
  if (!syncWriteClipboardText(text)) return false
  applyCodeBlockCmCut(view, from, to)
  return true
}

export function runCodeBlockCmPasteKeymap(view: EditorView): boolean {
  if (!view.hasFocus) focusCodeBlockCmView(view)
  void codeBlockCmPaste(view)
  return true
}

/** Capture copy/cut on code-block CM — WKWebView needs explicit clipboardData. */
export function installCodeBlockCmClipboardCapture(
  wrap: HTMLElement,
  handlers: { getCmView: () => EditorView | null },
): () => void {
  const onCopy = (event: ClipboardEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !isCodeBlockCmMouseTarget(target)) return
    const view = handlers.getCmView()
    if (!view) return
    handleCodeBlockCmCopyEvent(event, view)
  }
  const onCut = (event: ClipboardEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !isCodeBlockCmMouseTarget(target)) return
    const view = handlers.getCmView()
    if (!view) return
    handleCodeBlockCmCutEvent(event, view)
  }
  wrap.addEventListener('copy', onCopy, true)
  wrap.addEventListener('cut', onCut, true)
  return () => {
    wrap.removeEventListener('copy', onCopy, true)
    wrap.removeEventListener('cut', onCut, true)
  }
}
