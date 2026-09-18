import {
  bridgeInsertAssistantMarkdown,
  bridgeRefocusActiveEditor,
  bridgeRestoreInsertAnchor,
  bridgeRestoreLastNonEmptySelection,
} from '../../editorMutationBridge'
import { clearEditorAiInsertUndo, isEditorAiInsertUndoStillValid } from '../editorAiInsertFeedback'
import { undoLastTransaction } from '../../../menu/commandTransaction'
import { flushVmCmRecorderBatch } from '../../../vm/vmCmRecorder'
import { flushVmTiptapRecorderBatch } from '../../../vm/vmTiptapRecorder'
import { normalizeAssistantInsertMarkdown } from './normalizeAssistantInsertMarkdown'

export type InsertAssistantTextMode = 'insert' | 'replace'

export function insertAssistantText(text: string, mode: InsertAssistantTextMode): boolean {
  const normalized = normalizeAssistantInsertMarkdown(text)
  if (!normalized) return false
  if (mode === 'replace') {
    if (!bridgeRestoreLastNonEmptySelection()) return false
  } else if (!bridgeRestoreInsertAnchor()) {
    bridgeRefocusActiveEditor()
  }
  return bridgeInsertAssistantMarkdown(normalized, mode)
}

export function undoAssistantInsert(docId: string | null): boolean {
  if (!docId?.trim()) return false
  flushVmTiptapRecorderBatch(docId)
  flushVmCmRecorderBatch(docId)
  return undoLastTransaction(docId)
}

export function performEditorAiInsertUndo(docId: string | null): boolean {
  if (!isEditorAiInsertUndoStillValid(docId)) {
    clearEditorAiInsertUndo()
    return false
  }
  bridgeRefocusActiveEditor()
  const ok = undoAssistantInsert(docId)
  if (!ok) return false
  clearEditorAiInsertUndo()
  bridgeRefocusActiveEditor()
  return true
}
