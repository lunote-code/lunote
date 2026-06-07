import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

import type { CodeBlockBoundarySession } from './codeBlockBoundarySession'

type BlockPos = number

const sessionsByEditor = new WeakMap<Editor, Map<BlockPos, CodeBlockBoundarySession>>()
const sessionsByView = new WeakMap<EditorView, Map<BlockPos, CodeBlockBoundarySession>>()

function blockSessionMap<T extends object>(
  store: WeakMap<T, Map<BlockPos, CodeBlockBoundarySession>>,
  key: T,
): Map<BlockPos, CodeBlockBoundarySession> {
  let map = store.get(key)
  if (!map) {
    map = new Map()
    store.set(key, map)
  }
  return map
}

export function registerCodeBlockBoundarySession(
  editor: Editor,
  blockPos: number,
  session: CodeBlockBoundarySession,
): void {
  blockSessionMap(sessionsByEditor, editor).set(blockPos, session)
  if (editor.view) {
    blockSessionMap(sessionsByView, editor.view).set(blockPos, session)
  }
}

export function unregisterCodeBlockBoundarySession(editor: Editor, blockPos: number): void {
  blockSessionMap(sessionsByEditor, editor).delete(blockPos)
  if (editor.view) {
    blockSessionMap(sessionsByView, editor.view).delete(blockPos)
  }
}

export function getCodeBlockBoundarySession(
  editor: Editor,
  blockPos: number,
): CodeBlockBoundarySession | null {
  return sessionsByEditor.get(editor)?.get(blockPos) ?? null
}

export function getCodeBlockBoundarySessionForView(
  view: EditorView,
  blockPos: number,
): CodeBlockBoundarySession | null {
  return sessionsByView.get(view)?.get(blockPos) ?? null
}

export function isCodeBlockFoldTransitionActive(editor: Editor, blockPos: number): boolean {
  return getCodeBlockBoundarySession(editor, blockPos)?.isFoldTransitionActive() ?? false
}

export function isCodeBlockFoldTransitionActiveForView(view: EditorView, blockPos: number): boolean {
  return getCodeBlockBoundarySessionForView(view, blockPos)?.isFoldTransitionActive() ?? false
}

export function isAnyCodeBlockFoldTransitionActive(editor: Editor): boolean {
  const map = sessionsByEditor.get(editor)
  if (!map) return false
  for (const session of map.values()) {
    if (session.isFoldTransitionActive()) return true
  }
  return false
}

/** Cancel blur suppress / pending blur-exit when the user clicks outside CM into body text. */
export function prepareCodeBlockCmExitForOutsideClick(view: EditorView): void {
  const map = sessionsByView.get(view)
  if (!map) return
  for (const session of map.values()) {
    session.clearBlurSuppress()
    session.clearBlurExitTimer()
  }
}
