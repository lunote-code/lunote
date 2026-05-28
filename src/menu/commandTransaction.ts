/**
 * Command Transaction VM — gate, execute via VM pipeline, step-log.
 *
 * Architecture (VM-FIRST for structured commands):
 *   createTransaction  → validates editor is ready, builds op list
 *   executeOps         → converts EditorOps → VMBridgeOps → applyVMSteps()
 *                        ALL mutations go through applyVMSteps (single execution entry)
 *   Recorders          → VmTiptapRecorder + VmCmRecorder capture PM/CM steps for undo
 *   undoLastTransaction / redoLastTransaction → pop step log, apply via bridge
 *
 * applyVMSteps is the ONLY mutation execution path.
 * No mutation function is called directly from this module.
 */
import type { EphemeralCommandType } from '../editor/ephemeralFormatting'
import {
  bridgeHasVisualEditor,
  bridgeHasSourceView,
  getBridgePaneMode,
  applyVMSteps,
  bridgeApplyInvertedPmSteps,
  bridgeApplyForwardPmSteps,
  bridgeApplyInverseCmChanges,
  bridgeApplyForwardCmChanges,
} from '../editor/editorMutationBridge'
import type { TiptapEditorCommand } from '../editor/TiptapMarkdownEditor'
import type { ResolvedCommand } from './commandResolution.types'
import type { SourceEditorOp } from './commandOps.types'
import type { VMBridgeOp } from '../vm/vmBridgeOps'
import type { EditorPaneMode } from './commandContext'
import type { StepLogEntry } from '../vm/vmStepLog'
import {
  popForUndo,
  popForRedo,
  peekForUndo,
  peekForRedo,
  restoreUndoneEntry,
  restoreRedoneEntry,
  resetStepLog,
} from '../vm/vmStepLog'
import { flushVmTiptapRecorderBatch, setVmTiptapRecorderDocId } from '../vm/vmTiptapRecorder'
import { flushVmCmRecorderBatch, setVmCmRecorderDocId } from '../vm/vmCmRecorder'

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export type EditorOp =
  | { kind: 'tiptap-ephemeral'; mark: EphemeralCommandType; placeholder?: string }
  | { kind: 'source-ephemeral'; mark: EphemeralCommandType }
  | { kind: 'tiptap-command'; command: TiptapEditorCommand }
  | { kind: 'source-command'; op: SourceEditorOp }

export type CommandTransaction = {
  id: string
  commandId: string
  ops: EditorOp[]
  metadata: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────
// Active document tracking
// ─────────────────────────────────────────────────────────────

/**
 * Call when the active document changes.
 * Propagates the docId to both recorders so step entries are keyed correctly.
 */
export function setActiveTransactionDoc(docId: string): void {
  setVmTiptapRecorderDocId(docId)
  setVmCmRecorderDocId(docId)
}

/**
 * Reset the step log for a doc (or all docs).
 * Alias kept for backward compatibility with tests.
 */
export function resetTransactionLog(docId?: string): void {
  resetStepLog(docId)
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function nextTransactionId(): string {
  return `tx_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

// ─────────────────────────────────────────────────────────────
// createTransaction — validation gate
// Returns null when the required editor is not ready.
// ─────────────────────────────────────────────────────────────

export function createTransaction(resolved: ResolvedCommand): CommandTransaction | null {
  const needsVisual =
    resolved.kind === 'tiptap-ephemeral' || resolved.kind === 'tiptap-command'
  const needsSource =
    resolved.kind === 'source-ephemeral' || resolved.kind === 'source-command'

  if (needsVisual && !bridgeHasVisualEditor()) return null
  if (needsSource && !bridgeHasSourceView()) return null
  if (!needsVisual && !needsSource) return null

  const ops: EditorOp[] = []

  switch (resolved.kind) {
    case 'tiptap-ephemeral':
      ops.push({ kind: 'tiptap-ephemeral', mark: resolved.mark, placeholder: resolved.placeholder })
      break
    case 'source-ephemeral':
      ops.push({ kind: 'source-ephemeral', mark: resolved.mark })
      break
    case 'tiptap-command':
      ops.push({ kind: 'tiptap-command', command: resolved.command })
      break
    case 'source-command':
      ops.push({ kind: 'source-command', op: resolved.op })
      break
    default:
      return null
  }

  return {
    id: nextTransactionId(),
    commandId: resolved.commandId,
    ops,
    metadata: { resolvedKind: resolved.kind },
  }
}

// ─────────────────────────────────────────────────────────────
// executeOps — VM pipeline: EditorOp → VMBridgeOp → applyVMSteps
//
// applyVMSteps is the SINGLE execution entry point.
// VmTiptapRecorder / VmCmRecorder capture the resulting PM/CM
// transactions automatically — no manual commit needed.
// ─────────────────────────────────────────────────────────────

function editorOpToVMBridgeOps(op: EditorOp): VMBridgeOp[] {
  switch (op.kind) {
    case 'tiptap-ephemeral':
      return [{ kind: 'ephemeralMark', mark: op.mark, placeholder: op.placeholder }]
    case 'source-ephemeral':
      return [{ kind: 'sourceEphemeral', mark: op.mark }]
    case 'tiptap-command':
      return [{ kind: 'tiptapCommand', command: op.command }]
    case 'source-command':
      return [{ kind: 'sourceOp', op: op.op }]
    default: {
      const _exhaustive: never = op
      void _exhaustive
      return []
    }
  }
}

export function executeOps(transaction: CommandTransaction): void {
  const bridgeOps: VMBridgeOp[] = []
  for (const op of transaction.ops) {
    bridgeOps.push(...editorOpToVMBridgeOps(op))
  }
  applyVMSteps(bridgeOps)
}

// ─────────────────────────────────────────────────────────────
// Undo / Redo — document-scoped, VM step-log based
//
// Native editor history is disabled:
//   Visual: StarterKit history:false
//   Source: history() extension removed from CM extensions
//
// Undo pops the top entry from the step log and applies:
//   PMStepEntry   → bridgeApplyInvertedPmSteps
//   CMChangeEntry → bridgeApplyInverseCmChanges
//
// Redo pushes the next entry forward and applies:
//   PMStepEntry   → bridgeApplyForwardPmSteps
//   CMChangeEntry → bridgeApplyForwardCmChanges
// ─────────────────────────────────────────────────────────────

function stepEntryAppliesInMode(entry: StepLogEntry, mode: EditorPaneMode): boolean {
  if (mode === 'visual') {
    return entry.kind === 'pm-steps' && bridgeHasVisualEditor()
  }
  return entry.kind === 'cm-change' && bridgeHasSourceView()
}

function applyUndoEntry(entry: StepLogEntry): boolean {
  switch (entry.kind) {
    case 'pm-steps':
      return bridgeApplyInvertedPmSteps(entry.invertedSteps, entry.selectionBefore)
    case 'cm-change':
      return bridgeApplyInverseCmChanges(entry.inverseChanges, entry.selectionBefore)
  }
}

function applyRedoEntry(entry: StepLogEntry): boolean {
  switch (entry.kind) {
    case 'pm-steps':
      return bridgeApplyForwardPmSteps(entry.forwardSteps, entry.selectionAfter)
    case 'cm-change':
      return bridgeApplyForwardCmChanges(entry.forwardChanges, entry.selectionAfter)
  }
}

export function undoLastTransaction(docId: string): boolean {
  flushVmTiptapRecorderBatch(docId)
  flushVmCmRecorderBatch(docId)
  const mode = getBridgePaneMode()
  const entry = peekForUndo(docId)
  if (!entry || !stepEntryAppliesInMode(entry, mode)) return false

  popForUndo(docId)
  const ok = applyUndoEntry(entry)
  if (!ok) restoreUndoneEntry(docId)
  return ok
}

export function redoLastTransaction(docId: string): boolean {
  flushVmTiptapRecorderBatch(docId)
  flushVmCmRecorderBatch(docId)
  const mode = getBridgePaneMode()
  const entry = peekForRedo(docId)
  if (!entry || !stepEntryAppliesInMode(entry, mode)) return false

  popForRedo(docId)
  const ok = applyRedoEntry(entry)
  if (!ok) restoreRedoneEntry(docId)
  return ok
}
