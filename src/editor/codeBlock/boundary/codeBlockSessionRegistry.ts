import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

const flushByEditor = new WeakMap<Editor, Set<() => void>>()
const flushByView = new WeakMap<EditorView, Set<() => void>>()

type ExitEntry = { wrap: HTMLElement; exit: () => void }

const exitEditingByEditor = new WeakMap<Editor, Set<ExitEntry>>()
const exitEditingByView = new WeakMap<EditorView, Set<ExitEntry>>()

function flushSet<T extends object>(store: WeakMap<T, Set<() => void>>, key: T): Set<() => void> {
  let set = store.get(key)
  if (!set) {
    set = new Set()
    store.set(key, set)
  }
  return set
}

function exitSet(store: WeakMap<Editor, Set<ExitEntry>>, key: Editor): Set<ExitEntry>
function exitSet(store: WeakMap<EditorView, Set<ExitEntry>>, key: EditorView): Set<ExitEntry>
function exitSet(store: WeakMap<object, Set<ExitEntry>>, key: object): Set<ExitEntry> {
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

/** Register immediate exit-editing for block-switch / serialize cleanup. */
export function registerCodeBlockSessionExitEditing(
  editor: Editor,
  wrap: HTMLElement,
  exit: () => void,
): () => void {
  const entry: ExitEntry = { wrap, exit }
  exitSet(exitEditingByEditor, editor).add(entry)
  if (editor.view) {
    exitSet(exitEditingByView, editor.view).add(entry)
  }
  return () => {
    exitEditingByEditor.get(editor)?.delete(entry)
    if (editor.view) {
      exitEditingByView.get(editor.view)?.delete(entry)
    }
  }
}

export function exitOtherCodeBlockEditingForView(view: EditorView, activeWrap: HTMLElement): void {
  const set = exitEditingByView.get(view)
  if (!set) return
  for (const entry of set) {
    if (entry.wrap === activeWrap) continue
    entry.exit()
  }
}

export function exitAllCodeBlockEditingForView(view: EditorView): void {
  const set = exitEditingByView.get(view)
  if (!set) return
  for (const entry of set) entry.exit()
}
