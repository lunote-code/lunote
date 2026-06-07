import { selectAll as cmSelectAll } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'

import { applyCodeBlockCmCut } from './codeBlockCmFocus'
import { applyWebviewPasteFallback } from '../../webviewPasteBridge'

export function codeBlockCmHasSelection(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  return from !== to
}

export function codeBlockCmSelectedText(view: EditorView): string {
  const { from, to } = view.state.selection.main
  if (from === to) return ''
  return view.state.sliceDoc(from, to)
}

/** Sync clipboard write for Cmd+C / capture fallback (WKWebView keydown cannot rely on async API). */
export function syncWriteClipboardText(text: string): boolean {
  if (!text) return false
  const previous = document.activeElement
  let ok: boolean
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', 'true')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    ok = document.execCommand('copy')
    ta.remove()
  } catch {
    ok = false
  } finally {
    if (previous instanceof HTMLElement && document.activeElement !== previous) {
      try {
        previous.focus({ preventScroll: true })
      } catch {
        /* ignore */
      }
    }
  }
  return ok
}

async function writeClipboardText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return syncWriteClipboardText(text)
  }
}

export function codeBlockCmRestoreSelection(view: EditorView, from: number, to: number): void {
  const len = view.state.doc.length
  const anchor = Math.max(0, Math.min(from, len))
  const head = Math.max(0, Math.min(to, len))
  const sel = view.state.selection.main
  if (sel.from === anchor && sel.to === head) return
  view.dispatch({ selection: { anchor, head } })
}

export async function codeBlockCmCopySelection(view: EditorView): Promise<boolean> {
  const text = codeBlockCmSelectedText(view)
  if (!text) return false
  return writeClipboardText(text)
}

export async function codeBlockCmCutSelection(view: EditorView): Promise<boolean> {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  const text = view.state.sliceDoc(from, to)
  const ok = await writeClipboardText(text)
  if (!ok) return false
  applyCodeBlockCmCut(view, from, to)
  return true
}

export async function codeBlockCmPaste(view: EditorView): Promise<boolean> {
  return applyWebviewPasteFallback({ cmView: view, plainOnly: true })
}

export function codeBlockCmSelectAll(view: EditorView): boolean {
  return cmSelectAll(view)
}
