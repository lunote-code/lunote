/**
 * VmTiptapRecorder — Tiptap extension that captures ALL ProseMirror transactions
 * into the VM step log for undo/redo.
 *
 * How it works:
 *   - Uses appendTransaction hook (fires after every PM transaction batch)
 *   - Collects Step.invert(docBefore) for each step → stored as invertedSteps
 *   - Stores original forwardSteps for redo
 *   - Skips its own undo/redo transactions (marked with VM_UNDO_META / VM_REDO_META)
 *   - Batches rapid typing / IME composition into single undo entries (time + composing)
 *
 * Platform constraints:
 *   - appendTransaction fires AFTER the transaction; typing is observed, not blocked.
 *   - IME composition is tracked via view.composing; batch flushes on compositionend.
 */
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep, type Step } from '@tiptap/pm/transform'

import {
  pushStepEntry,
  truncateStepLogRedoTail,
  VM_UNDO_META,
  VM_REDO_META,
  VM_SKIP_RECORD_META,
  type PMStepEntry,
} from './vmStepLog'

// ─────────────────────────────────────────────────────────────
// Active doc ID (set by App.tsx / commandTransaction when document changes)
// ─────────────────────────────────────────────────────────────

let activeDocId = ''

/** Merge two PM step entries (A applied before B) into one undo unit. */
function mergePMEntries(a: PMStepEntry, b: PMStepEntry): PMStepEntry {
  return {
    kind: 'pm-steps',
    forwardSteps: [...a.forwardSteps, ...b.forwardSteps],
    invertedSteps: [...b.invertedSteps, ...a.invertedSteps],
    selectionBefore: a.selectionBefore,
    selectionAfter: b.selectionAfter,
  }
}

// ─────────────────────────────────────────────────────────────
// Typing / IME batching (module-level, keyed by active doc)
// ─────────────────────────────────────────────────────────────

const TYPE_BATCH_MS = 1000
/** Single-transaction step count above this → immediate undo entry (paste, large ops). */
const IMMEDIATE_PUSH_STEP_THRESHOLD = 8

let pendingBatch: PMStepEntry | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let viewComposing = false

function clearFlushTimer(): void {
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

function flushPendingBatch(docId: string): void {
  clearFlushTimer()
  if (!pendingBatch) {
    pendingBatch = null
    return
  }
  pushStepEntry(docId, pendingBatch)
  pendingBatch = null
}

function mergeIntoPending(docId: string, entry: PMStepEntry): void {
  if (!pendingBatch) {
    truncateStepLogRedoTail(docId)
  }
  pendingBatch = pendingBatch ? mergePMEntries(pendingBatch, entry) : entry
}

function scheduleBatchFlush(docId: string): void {
  clearFlushTimer()
  flushTimer = setTimeout(() => flushPendingBatch(docId), TYPE_BATCH_MS)
}

/** True when every step is character-level replace (typing), not marks/blocks. */
function isTypingOnlySteps(steps: readonly Step[]): boolean {
  return steps.every((s) => s instanceof ReplaceStep || s instanceof ReplaceAroundStep)
}

function enqueuePMEntry(docId: string, entry: PMStepEntry, forceImmediate: boolean): void {
  const immediate = forceImmediate || !isTypingOnlySteps(entry.forwardSteps)
  if (immediate) {
    flushPendingBatch(docId)
    pushStepEntry(docId, entry)
    return
  }
  if (viewComposing) {
    mergeIntoPending(docId, entry)
    return
  }
  mergeIntoPending(docId, entry)
  scheduleBatchFlush(docId)
}

export function setVmTiptapRecorderDocId(docId: string): void {
  if (activeDocId && activeDocId !== docId) {
    flushPendingBatch(activeDocId)
  }
  activeDocId = docId
}

/** Active document id for VM undo/redo (set on tab switch). */
export function getVmTiptapRecorderDocId(): string {
  return activeDocId
}

// ─────────────────────────────────────────────────────────────
// Extension
// ─────────────────────────────────────────────────────────────

export const VmTiptapRecorder = Extension.create({
  name: 'vmTiptapRecorder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        view() {
          return {
            update(view, prevState) {
              const wasComposing = viewComposing
              viewComposing = view.composing
              if (wasComposing && !viewComposing) {
                flushPendingBatch(activeDocId)
              }
              void prevState
            },
            destroy() {
              flushPendingBatch(activeDocId)
            },
          }
        },

        appendTransaction(transactions, oldState, newState) {
          const shouldSkip = transactions.some(
            (tr) =>
              tr.getMeta(VM_UNDO_META) || tr.getMeta(VM_REDO_META) || tr.getMeta(VM_SKIP_RECORD_META),
          )
          if (shouldSkip) return null

          const forwardSteps: Step[] = []
          const invertedStepsReversed: Step[] = []

          for (const tr of transactions) {
            if (!tr.docChanged) continue
            for (let i = 0; i < tr.steps.length; i++) {
              forwardSteps.push(tr.steps[i])
              invertedStepsReversed.push(tr.steps[i].invert(tr.docs[i]))
            }
          }

          if (forwardSteps.length === 0) return null

          const entry: PMStepEntry = {
            kind: 'pm-steps',
            forwardSteps,
            invertedSteps: [...invertedStepsReversed].reverse(),
            selectionBefore: {
              from: oldState.selection.from,
              to: oldState.selection.to,
            },
            selectionAfter: {
              from: newState.selection.from,
              to: newState.selection.to,
            },
          }

          const forceImmediate = forwardSteps.length >= IMMEDIATE_PUSH_STEP_THRESHOLD
          enqueuePMEntry(activeDocId, entry, forceImmediate)
          return null
        },
      }),
    ]
  },
})

/** Flush batched typing undo entries (tests, doc switch, unmount). */
export function flushVmTiptapRecorderBatch(docId?: string): void {
  flushPendingBatch(docId ?? activeDocId)
}

export { TextSelection }
