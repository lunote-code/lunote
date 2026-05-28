/**
 * VM Command Language — the single vocabulary through which all editor mutations
 * are expressed.  A VMCommand is created by the input layer and consumed by
 * vmReducer.  NO command may bypass this type system.
 *
 * Design contract:
 *   - Commands are PURE DATA (serializable, no functions)
 *   - Commands carry all context needed by the reducer (no editor reads inside reducer)
 *   - Context is sampled ONCE at command-creation time (in commandTransaction or inputRouter)
 *
 * Architecture position:
 *   Input Layer → VMCommand → vmReducer → VMBridgeOp[] → Bridge → Editor
 *
 * ─────────────────────────────────────────────────────────────
 * TYPING / IME CONSTRAINT (hard platform limit)
 * ─────────────────────────────────────────────────────────────
 * Character-level typing (beforeinput / compositionupdate) cannot be routed
 * through VMCommand without breaking IME composition (CJK, Korean, Arabic,
 * Indic) and mobile predictive text.  ProseMirror's appendTransaction hook
 * (VmTiptapRecorder) captures the resulting PM Steps — which ARE the
 * deterministic, reversible, atomic steps this command layer produces for
 * structured commands.  Both paths feed the same VM undo/redo stack.
 * ─────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────
// Shared context types — sampled from editor BEFORE command creation
// ─────────────────────────────────────────────────────────────

export type SelectionContext = {
  from: number
  to: number
  empty: boolean
}

export type MarkContext = {
  /** true if the mark is already active on the ENTIRE selection range */
  isActive: boolean
}

export type BlockContext = {
  /** ProseMirror node type name at cursor (e.g. 'paragraph', 'heading', 'bulletList') */
  currentNodeType: string
  /** current heading level, if applicable */
  currentLevel?: number
}

// ─────────────────────────────────────────────────────────────
// VM Command union
// ─────────────────────────────────────────────────────────────

/** Toggle an inline mark (bold, italic, code, underline, strike) */
export type FormatMarkCmd = {
  kind: 'formatMark'
  mark: string            // 'bold' | 'italic' | 'code' | 'underline' | 'strike'
  selection: SelectionContext
  markCtx: MarkContext
  placeholder?: string   // for empty-selection slash-command style
  docId: string
}

/** Set block type at cursor (heading, paragraph, list, quote, etc.) */
export type SetBlockTypeCmd = {
  kind: 'setBlockType'
  targetNodeType: string  // 'heading' | 'paragraph' | 'bulletList' | 'orderedList' | 'taskList' | 'blockquote'
  attrs?: Record<string, unknown>
  selection: SelectionContext
  blockCtx: BlockContext  // current node type — used by reducer to generate undo context
  docId: string
}

/** Insert a horizontal rule / thematic break */
export type InsertHrCmd = {
  kind: 'insertHr'
  selection: SelectionContext
  docId: string
}

/** Insert plain text at selection (replaces selection if non-empty) */
export type InsertPlainTextCmd = {
  kind: 'insertPlainText'
  text: string
  selection: SelectionContext
  docId: string
}

/** Delete the current selection (or char backward if empty) */
export type DeleteSelectionCmd = {
  kind: 'deleteSelection'
  selection: SelectionContext
  docId: string
}

/** Cut: copy selection to clipboard then delete */
export type CutCmd = {
  kind: 'cut'
  selection: SelectionContext
  docId: string
}

/** Insert a code fence with a given language */
export type InsertCodeFenceCmd = {
  kind: 'insertCodeFence'
  language: string
  mode: 'visual' | 'source'
  selection: SelectionContext
  docId: string
}

/** Source-mode structured operation (indent, heading delta, etc.) */
export type SourceOpCmd = {
  kind: 'sourceOp'
  op: import('../menu/commandOps.types').SourceEditorOp
  selection: SelectionContext
  docId: string
}

/** Ephemeral source-mode formatting (surround selection) */
export type SourceEphemeralCmd = {
  kind: 'sourceEphemeral'
  mark: import('../editor/ephemeralFormatting').EphemeralCommandType
  selection: SelectionContext
  docId: string
}

export type VMCommand =
  | FormatMarkCmd
  | SetBlockTypeCmd
  | InsertHrCmd
  | InsertPlainTextCmd
  | DeleteSelectionCmd
  | CutCmd
  | InsertCodeFenceCmd
  | SourceOpCmd
  | SourceEphemeralCmd
