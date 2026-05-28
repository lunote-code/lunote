/**
 * VM Step Log — the single source-of-truth for undo/redo state.
 *
 * Replaces snapshot-based undo (full JSON doc clone) with step-based undo:
 *   - Visual mode: ProseMirror Step inversion (appendTransaction recorder)
 *   - Source mode: CodeMirror ChangeSet inversion (updateListener recorder)
 *
 * ALL mutations (including typing, paste, and structured commands) are recorded
 * here by the recorders.  commandTransaction.ts undo/redo reads from here.
 *
 * Meta/annotation constants are co-located here to avoid circular imports.
 */
import type { Step } from '@tiptap/pm/transform'
import { Annotation } from '@codemirror/state'
import type { ChangeSet } from '@codemirror/state'

// ─────────────────────────────────────────────────────────────
// PM / CM marker constants
// Both VmTiptapRecorder and editorMutationBridge use these to
// mark undo/redo transactions so the recorder skips them.
// ─────────────────────────────────────────────────────────────

export const VM_UNDO_META = 'vmUndo'
export const VM_REDO_META = 'vmRedo'
export const VM_SKIP_RECORD_META = 'vmSkipRecord'

export const vmUndoAnnotation = Annotation.define<boolean>()
export const vmRedoAnnotation = Annotation.define<boolean>()

// ─────────────────────────────────────────────────────────────
// Step entry types
// ─────────────────────────────────────────────────────────────

/**
 * Captured from VmTiptapRecorder.appendTransaction.
 * Covers ALL visual-mode mutations: typing, paste, bold, heading, etc.
 */
export type PMStepEntry = {
  kind: 'pm-steps'
  /** Steps to APPLY for undo (already in application order, reversed from forward) */
  invertedSteps: readonly Step[]
  /** Original forward steps — applied for redo */
  forwardSteps: readonly Step[]
  selectionBefore: { from: number; to: number }
  selectionAfter: { from: number; to: number }
}

/**
 * Captured from VmCmRecorder.updateListener.
 * Covers ALL source-mode mutations: typing, paste, structured inserts, etc.
 */
export type CMChangeEntry = {
  kind: 'cm-change'
  /** Inverse ChangeSet — apply for undo */
  inverseChanges: ChangeSet
  /** Original forward ChangeSet — apply for redo */
  forwardChanges: ChangeSet
  selectionBefore: { from: number; to: number }
  selectionAfter: { from: number; to: number }
}

export type StepLogEntry = PMStepEntry | CMChangeEntry

// ─────────────────────────────────────────────────────────────
// Per-document log (LIFO undo stack with redo tail)
// ─────────────────────────────────────────────────────────────

type DocLog = {
  /** All recorded entries. index points to the last applied entry. */
  log: StepLogEntry[]
  /**
   * Current position. -1 = before all entries (fully undone).
   * Entries at [0..index] are "done"; entries at [index+1..] are "redo-able".
   */
  index: number
}

/** Per-document undo depth cap — prevents unbounded Step/ChangeSet retention. */
export const MAX_UNDO_ENTRIES_PER_DOC = 200

const docLogs = new Map<string, DocLog>()

function trimLogToMax(log: DocLog): void {
  const overflow = log.log.length - MAX_UNDO_ENTRIES_PER_DOC
  if (overflow <= 0) return
  log.log.splice(0, overflow)
  log.index = Math.max(-1, log.index - overflow)
}

function getLog(docId: string): DocLog {
  let entry = docLogs.get(docId)
  if (!entry) {
    entry = { log: [], index: -1 }
    docLogs.set(docId, entry)
  }
  return entry
}

// ─────────────────────────────────────────────────────────────
// Mutation operations
// ─────────────────────────────────────────────────────────────

/** Drop redo branch without pushing a new entry (used when starting a typing batch). */
export function truncateStepLogRedoTail(docId: string): void {
  const log = getLog(docId)
  log.log.splice(log.index + 1)
}

/** Push a new entry.  Truncates redo tail (new mutation invalidates redo). */
export function pushStepEntry(docId: string, entry: StepLogEntry): void {
  const log = getLog(docId)
  log.log.splice(log.index + 1) // clear redo tail
  log.log.push(entry)
  log.index = log.log.length - 1
  trimLogToMax(log)
}

/** Release undo/redo state when a tab/document is closed. */
/** Evict undo stack for a closed document. Empty string is a valid doc key (tests). */
export function evictStepLog(docId: string): void {
  docLogs.delete(docId)
}

/** Pop top entry for undo (moves index back).  Returns null if nothing to undo. */
export function popForUndo(docId: string): StepLogEntry | null {
  const log = getLog(docId)
  if (log.index < 0) return null
  const entry = log.log[log.index] ?? null
  log.index -= 1
  return entry
}

/** Peek top undo entry without mutating the stack. */
export function peekForUndo(docId: string): StepLogEntry | null {
  const log = getLog(docId)
  if (log.index < 0) return null
  return log.log[log.index] ?? null
}

/** Restore the most recently popped undo entry after a failed apply. */
export function restoreUndoneEntry(docId: string): void {
  const log = getLog(docId)
  if (log.index + 1 < log.log.length) {
    log.index += 1
  }
}

/** Peek next redo entry without mutating the stack. */
export function peekForRedo(docId: string): StepLogEntry | null {
  const log = getLog(docId)
  const next = log.index + 1
  if (next >= log.log.length) return null
  return log.log[next] ?? null
}

/** Restore the most recently popped redo entry after a failed apply. */
export function restoreRedoneEntry(docId: string): void {
  const log = getLog(docId)
  if (log.index > 0) {
    log.index -= 1
  }
}

/** Pop next entry for redo (moves index forward).  Returns null if nothing to redo. */
export function popForRedo(docId: string): StepLogEntry | null {
  const log = getLog(docId)
  const next = log.index + 1
  if (next >= log.log.length) return null
  const entry = log.log[next] ?? null
  log.index = next
  return entry
}

export function resetStepLog(docId?: string): void {
  if (docId !== undefined) {
    docLogs.delete(docId)
  } else {
    docLogs.clear()
  }
}

export function getUndoDepth(docId: string): number {
  return getLog(docId).index + 1
}

export function getRedoDepth(docId: string): number {
  const log = getLog(docId)
  return log.log.length - (log.index + 1)
}
