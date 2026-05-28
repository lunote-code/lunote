/**
 * VmCmRecorder — CodeMirror extension that captures CM transactions into VM undo/redo.
 */
import { Annotation } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import {
  pushStepEntry,
  truncateStepLogRedoTail,
  vmUndoAnnotation,
  vmRedoAnnotation,
  type CMChangeEntry,
} from './vmStepLog'

let activeDocId = ''
const TYPE_BATCH_MS = 1000

/** During the IME word composition period, it is merged into a single undo (retaining the last docChanged snapshot).*/
let pendingEntry: CMChangeEntry | null = null
let viewComposing = false
let flushTimer: ReturnType<typeof setTimeout> | null = null

function mergeCmEntries(a: CMChangeEntry, b: CMChangeEntry): CMChangeEntry {
  return {
    kind: 'cm-change',
    inverseChanges: b.inverseChanges.compose(a.inverseChanges),
    forwardChanges: a.forwardChanges.compose(b.forwardChanges),
    selectionBefore: a.selectionBefore,
    selectionAfter: b.selectionAfter,
  }
}

function clearFlushTimer(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export function setVmCmRecorderDocId(docId: string): void {
  if (activeDocId && activeDocId !== docId) {
    flushPendingCmEntry(activeDocId)
  }
  activeDocId = docId
}

function flushPendingCmEntry(docId: string): void {
  clearFlushTimer()
  if (!pendingEntry) return
  pushStepEntry(docId, pendingEntry)
  pendingEntry = null
}

function mergeIntoPending(docId: string, entry: CMChangeEntry): void {
  if (!pendingEntry) truncateStepLogRedoTail(docId)
  pendingEntry = pendingEntry ? mergeCmEntries(pendingEntry, entry) : entry
}

function schedulePendingFlush(docId: string): void {
  clearFlushTimer()
  flushTimer = setTimeout(() => flushPendingCmEntry(docId), TYPE_BATCH_MS)
}

function isTypingLikeUpdate(update: Parameters<Parameters<typeof EditorView.updateListener.of>[0]>[0]): boolean {
  return update.transactions.some(
    (tr) =>
      tr.isUserEvent('input.type') ||
      tr.isUserEvent('delete.backward') ||
      tr.isUserEvent('delete.forward') ||
      tr.isUserEvent('delete.selection'),
  )
}

export function createVmCmRecorder(): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged || !activeDocId) return

    const isUndoRedo = update.transactions.some(
      (tr) =>
        tr.annotation(vmUndoAnnotation) === true ||
        tr.annotation(vmRedoAnnotation) === true,
    )
    if (isUndoRedo) return

    const wasComposing = viewComposing
    viewComposing = update.view.composing
    if (wasComposing && !viewComposing) {
      flushPendingCmEntry(activeDocId)
    }

    const entry: CMChangeEntry = {
      kind: 'cm-change',
      inverseChanges: update.changes.invert(update.startState.doc),
      forwardChanges: update.changes,
      selectionBefore: {
        from: update.startState.selection.main.from,
        to: update.startState.selection.main.to,
      },
      selectionAfter: {
        from: update.state.selection.main.from,
        to: update.state.selection.main.to,
      },
    }

    if (update.changes.length >= 800) {
      flushPendingCmEntry(activeDocId)
      pushStepEntry(activeDocId, entry)
      return
    }

    if (viewComposing || isTypingLikeUpdate(update)) {
      mergeIntoPending(activeDocId, entry)
      if (!viewComposing) schedulePendingFlush(activeDocId)
      return
    }

    flushPendingCmEntry(activeDocId)
    pushStepEntry(activeDocId, entry)
  })
}

export function flushVmCmRecorderBatch(docId?: string): void {
  flushPendingCmEntry(docId ?? activeDocId)
}

export { Annotation }
