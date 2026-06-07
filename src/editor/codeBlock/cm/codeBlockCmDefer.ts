import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { computeCodeBlockTextPatchRange, mapOffsetThroughTextPatch } from './codeBlockCmSync'

/** PM transactions dispatched from embedded code-block CM carry this meta. */
export const CODE_BLOCK_CM_ORIGIN_META = 'codeBlockCmOrigin'

function scheduleMicrotaskFlush(run: () => void): () => void {
  let scheduled = false
  return () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      run()
    })
  }
}

/** Defer CM doc-change callbacks until after the view update cycle (avoids PM dispatch re-entrancy). */
export function createDeferredCmDocChangeExtension(onDocChange: (value: string) => void): Extension[] {
  let pending: string | null = null
  const flushPending = scheduleMicrotaskFlush(() => {
    if (pending == null) return
    const value = pending
    pending = null
    onDocChange(value)
  })

  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      pending = update.state.doc.toString()
      if (update.view.compositionStarted) return
      flushPending()
    }),
    EditorView.domEventHandlers({
      compositionend: () => {
        if (pending == null) return
        const value = pending
        pending = null
        onDocChange(value)
      },
    }),
  ]
}

/** Apply a minimal PM→CM doc patch while preserving the current selection. */
export function patchCodeBlockCmDocFromPm(view: EditorView, nextDoc: string): boolean {
  const current = view.state.doc.toString()
  if (current === nextDoc) return false
  const patch = computeCodeBlockTextPatchRange(current, nextDoc)
  if (!patch) return false
  const { from, to, insert } = patch
  const sel = view.state.selection.main
  const anchor = mapOffsetThroughTextPatch(sel.anchor, from, to, insert.length)
  const head = mapOffsetThroughTextPatch(sel.head, from, to, insert.length)
  const len = nextDoc.length
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: Math.max(0, Math.min(anchor, len)), head: Math.max(0, Math.min(head, len)) },
  })
  return true
}

/** Apply a CM doc patch after the current stack (skip while IME composition is active). */
export function scheduleCodeBlockCmDocPatch(
  view: EditorView,
  doc: string,
  apply: (view: EditorView, doc: string) => void,
): () => void {
  let cancelled = false
  let composingWait = false

  const run = () => {
    if (cancelled) return
    if ((view as unknown as { destroyed?: boolean }).destroyed) return
    if (view.compositionStarted) {
      if (!composingWait) {
        composingWait = true
        const onEnd = () => {
          composingWait = false
          view.dom.removeEventListener('compositionend', onEnd)
          run()
        }
        view.dom.addEventListener('compositionend', onEnd)
      }
      return
    }
    apply(view, doc)
  }

  const schedule = scheduleMicrotaskFlush(run)
  schedule()

  return () => {
    cancelled = true
  }
}
