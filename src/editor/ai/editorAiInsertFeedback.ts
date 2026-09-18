type Sub = () => void

import { flushVmCmRecorderBatch } from '../../vm/vmCmRecorder'
import { getUndoDepth } from '../../vm/vmStepLog'
import { flushVmTiptapRecorderBatch } from '../../vm/vmTiptapRecorder'

type EditorAiInsertUndoState = {
  docId: string
  undoDepth: number
}

let pendingUndoState: EditorAiInsertUndoState | null = null
const subs = new Set<Sub>()

function notify(): void {
  for (const sub of subs) sub()
}

export function subscribeEditorAiInsertFeedback(cb: Sub): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function getEditorAiInsertUndoDocId(): string | null {
  return pendingUndoState?.docId ?? null
}

export function getEditorAiInsertUndoState(): EditorAiInsertUndoState | null {
  return pendingUndoState
}

function captureUndoDepth(docId: string): number {
  flushVmTiptapRecorderBatch(docId)
  flushVmCmRecorderBatch(docId)
  return getUndoDepth(docId)
}

export function notifyEditorAiInsertApplied(activePath: string | null): void {
  if (!activePath?.trim()) {
    clearEditorAiInsertUndo()
    return
  }
  const undoDepth = captureUndoDepth(activePath)
  if (undoDepth <= 0) {
    clearEditorAiInsertUndo()
    return
  }
  pendingUndoState = { docId: activePath, undoDepth }
  notify()
}

export function isEditorAiInsertUndoStillValid(docId: string | null): boolean {
  if (!docId?.trim() || pendingUndoState?.docId !== docId) return false
  return captureUndoDepth(docId) === pendingUndoState.undoDepth
}

export function clearEditorAiInsertUndo(): void {
  if (!pendingUndoState) return
  pendingUndoState = null
  notify()
}

export function resetEditorAiInsertFeedbackForTests(): void {
  pendingUndoState = null
  subs.clear()
}
