import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

const flushByEditor = new WeakMap<Editor, Set<() => void>>()
const flushByView = new WeakMap<EditorView, Set<() => void>>()
const exitEditingByEditor = new WeakMap<Editor, Set<() => void>>()
const exitEditingByView = new WeakMap<EditorView, Set<() => void>>()

function flushSet<T extends object>(store: WeakMap<T, Set<() => void>>, key: T): Set<() => void> {
  let set = store.get(key)
  if (!set) {
    set = new Set()
    store.set(key, set)
  }
  return set
}

/** Register a code-block session flush (commit CM doc → PM). */
export function registerCodeBlockSessionFlush(editor: Editor, flush: () => void): () => void {
  flushSet(flushByEditor, editor).add(flush)
  if (editor.view) {
    flushSet(flushByView, editor.view).add(flush)
  }
  return () => {
    flushByEditor.get(editor)?.delete(flush)
    if (editor.view) {
      flushByView.get(editor.view)?.delete(flush)
    }
  }
}

export function flushAllCodeBlockSessions(editor: Editor): void {
  const set = flushByEditor.get(editor)
  if (!set) return
  for (const flush of set) flush()
}

export function flushAllCodeBlockSessionsForView(view: EditorView): void {
  const set = flushByView.get(view)
  if (!set) return
  for (const flush of set) flush()
}

/** Register immediate exit-editing for outside-click (don't wait for blur-exit timer). */
export function registerCodeBlockSessionExitEditing(editor: Editor, exit: () => void): () => void {
  flushSet(exitEditingByEditor, editor).add(exit)
  if (editor.view) {
    flushSet(exitEditingByView, editor.view).add(exit)
  }
  return () => {
    exitEditingByEditor.get(editor)?.delete(exit)
    if (editor.view) {
      exitEditingByView.get(editor.view)?.delete(exit)
    }
  }
}

export function exitAllCodeBlockEditingForView(view: EditorView): void {
  const set = exitEditingByView.get(view)
  if (!set) return
  for (const exit of set) exit()
}
