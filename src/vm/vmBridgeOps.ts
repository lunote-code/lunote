/**
 * VMBridgeOp — the output type of vmReducer.
 *
 * These are high-level, mode-aware operations that editorMutationBridge
 * translates into actual PM / CM calls.  The bridge is a PURE EXECUTOR:
 * it does not make decisions — it only executes VMBridgeOps.
 *
 * For undo correctness, the resulting PM / CM transactions are captured
 * by VmTiptapRecorder / VmCmRecorder (PM's own Step inversion mechanism).
 */
import type { SelectionContext } from './vmCommands'
import type { SourceEditorOp } from '../menu/commandOps.types'
import type { EphemeralCommandType } from '../editor/ephemeralFormatting'
import type { TiptapEditorCommand } from '../editor/TiptapMarkdownEditor'

// ─────────────────────────────────────────────────────────────
// Mark operations
// ─────────────────────────────────────────────────────────────

export type SetMarkOp    = { kind: 'setMark'; mark: string; selection: SelectionContext }
export type UnsetMarkOp  = { kind: 'unsetMark'; mark: string; selection: SelectionContext }

/**
 * Ephemeral mark for empty-selection case:
 * inserts placeholder text with the mark applied (e.g., slash-command bold).
 */
export type EphemeralMarkOp = {
  kind: 'ephemeralMark'
  mark: string
  placeholder?: string
}

// ─────────────────────────────────────────────────────────────
// Block type operations
// ─────────────────────────────────────────────────────────────

export type SetHeadingOp      = { kind: 'setHeading'; level: number; selection: SelectionContext }
export type SetParagraphOp    = { kind: 'setParagraph'; selection: SelectionContext }
export type ToggleBulletListOp  = { kind: 'toggleBulletList'; selection: SelectionContext }
export type ToggleOrderedListOp = { kind: 'toggleOrderedList'; selection: SelectionContext }
export type ToggleTaskListOp    = { kind: 'toggleTaskList'; selection: SelectionContext }
export type ToggleBlockquoteOp  = { kind: 'toggleBlockquote'; selection: SelectionContext }

// ─────────────────────────────────────────────────────────────
// Insertion / deletion
// ─────────────────────────────────────────────────────────────

export type InsertHrOp      = { kind: 'insertHr' }
export type InsertTextOp    = { kind: 'insertText'; text: string; selection: SelectionContext }
export type DeleteSelectionOp = { kind: 'deleteSelection'; selection: SelectionContext }
export type CutSelectionOp  = { kind: 'cutSelection'; selection: SelectionContext }

// ─────────────────────────────────────────────────────────────
// Code fence
// ─────────────────────────────────────────────────────────────

export type InsertCodeFenceOp = {
  kind: 'insertCodeFence'
  language: string
  mode: 'visual' | 'source'
}

// ─────────────────────────────────────────────────────────────
// Source-mode passthrough
// ─────────────────────────────────────────────────────────────

export type SourceOpBridgeOp       = { kind: 'sourceOp'; op: SourceEditorOp }
export type SourceEphemeralBridgeOp = { kind: 'sourceEphemeral'; mark: EphemeralCommandType }

// ─────────────────────────────────────────────────────────────
// Tiptap command passthrough
// Complex editor operations (headingLevelDelta, callout, insertParagraphAbove/Below, etc.)
// that require runTiptapCommand's internal logic are wrapped here for uniform
// dispatch through applyVMSteps.
// ─────────────────────────────────────────────────────────────

export type TiptapCommandOp = { kind: 'tiptapCommand'; command: TiptapEditorCommand }

// ─────────────────────────────────────────────────────────────
// Union
// ─────────────────────────────────────────────────────────────

export type VMBridgeOp =
  | SetMarkOp
  | UnsetMarkOp
  | EphemeralMarkOp
  | SetHeadingOp
  | SetParagraphOp
  | ToggleBulletListOp
  | ToggleOrderedListOp
  | ToggleTaskListOp
  | ToggleBlockquoteOp
  | InsertHrOp
  | InsertTextOp
  | DeleteSelectionOp
  | CutSelectionOp
  | InsertCodeFenceOp
  | SourceOpBridgeOp
  | SourceEphemeralBridgeOp
  | TiptapCommandOp
