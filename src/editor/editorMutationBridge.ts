/**
 * EditorMutationBridge — the ONLY module allowed to call:
 *   editor.chain().run() / editor.commands.*
 *   view.dispatch(...)
 *   runEphemeralCommand / runEphemeralSurround
 *
 * All other modules that need to mutate editor state MUST call through this
 * module.  No other module is permitted to hold editor/view references for
 * mutation purposes.
 *
 * UI-layer code: call executeManifestCommand(commandId) — never this directly.
 * commandTransaction.ts is the only legitimate caller of the mutation fns below.
 *
 * Step-based undo/redo:
 *   bridgeApplyInvertedPmSteps  — apply PM inverted steps for visual-mode undo
 *   bridgeApplyForwardPmSteps   — apply PM forward steps for visual-mode redo
 *   bridgeApplyInverseCmChanges — apply CM inverse ChangeSet for source-mode undo
 *   bridgeApplyForwardCmChanges — apply CM forward ChangeSet for source-mode redo
 */
import type { MutableRefObject } from 'react'
import { EditorSelection } from '@codemirror/state'
import type { ChangeSet } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { scrollCodeMirrorViewToPos } from './caretAnchorScroll'
import type { Step } from '@tiptap/pm/transform'
import {
  deleteCharBackward,
  deleteLine,
  indentLess,
  indentMore,
  selectAll,
  selectLine,
  selectParentSyntax,
} from '@codemirror/commands'
import { openSearchPanel, replaceNext } from '@codemirror/search'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import {
  VM_UNDO_META,
  VM_REDO_META,
  vmUndoAnnotation,
  vmRedoAnnotation,
} from '../vm/vmStepLog'

import { runEphemeralCommand, type EphemeralCommandType, type RunEphemeralOptions } from './ephemeralFormatting'
import { destroySourceEphemeralSession, runEphemeralSurround } from './ephemeralFormattingSource'
import type { TiptapEditorCommand, TiptapMarkdownEditorHandle } from './TiptapMarkdownEditor'
import { buildNullEditorContext, buildSourceEditorContext, buildVisualEditorContext } from '../menu/commandContext'
import type { EditorContext, EditorPaneMode } from '../menu/commandContext'
import type { SourceEditorOp } from '../menu/commandOps.types'
import { applyPlainTextInsertion } from './inputLayer/inputLayerPaste'
import {
  insertCodeFenceForLang,
  insertMarkdownImage,
  insertMarkdownLink,
  insertMarkdownReferenceDef,
  insertMarkdownTable,
  insertPrefixLine,
  surroundSelection,
} from './markdownInsertHelpers'
import { openLunaEmojiPickerFromSourceView } from './lunaEmojiPicker'

// ─────────────────────────────────────────────────────────────
// EditorSnapshot — defined here to break commandTransaction circular dep
// ─────────────────────────────────────────────────────────────

export type EditorSnapshot =
  | { mode: 'visual'; doc: ReturnType<Editor['getJSON']>; selection: { from: number; to: number } }
  | { mode: 'source'; doc: string; selection: { from: number; to: number } }

// ─────────────────────────────────────────────────────────────
// Bridge refs — production path (via TiptapMarkdownEditorHandle)
// ─────────────────────────────────────────────────────────────

type BridgeRefs = {
  visualRef: MutableRefObject<TiptapMarkdownEditorHandle | null> | null
  sourceRef: MutableRefObject<EditorView | null> | null
  modeRef: MutableRefObject<EditorPaneMode> | null
}

const bridgeRefs: BridgeRefs = { visualRef: null, sourceRef: null, modeRef: null }

type CapturedEditorSelection = { mode: EditorPaneMode; from: number; to: number }

/** The top bar menu takes a snapshot when mousedown occurs; if the selection is lost before the command is executed, it will be restored.*/
let pendingSelectionRestore: CapturedEditorSelection | null = null
/** Most recent non-empty selection, used by commands that should still target the prior range after native menu focus loss. */
let lastNonEmptySelection: CapturedEditorSelection | null = null

// Test-only override — bypasses handle indirection
type TestOverride = { editor: Editor | null; view: EditorView | null; mode: EditorPaneMode }
let testOverride: TestOverride | null = null

/**
 * Initialize bridge with React refs. Call once on App mount and whenever
 * the editor surface changes. The bridge reads the refs lazily at call-time,
 * so it always sees the latest value without re-initialization.
 */
export function initEditorMutationBridge(
  visualRef: MutableRefObject<TiptapMarkdownEditorHandle | null>,
  sourceRef: MutableRefObject<EditorView | null>,
  modeRef: MutableRefObject<EditorPaneMode>,
): void {
  bridgeRefs.visualRef = visualRef
  bridgeRefs.sourceRef = sourceRef
  bridgeRefs.modeRef = modeRef
  testOverride = null
}

/** For tests only — bypasses handle; do NOT call in production code. */
export function _setEditorMutationBridgeForTest(
  editor: Editor | null,
  view: EditorView | null,
  mode: EditorPaneMode = 'visual',
): void {
  testOverride = { editor, view, mode }
}

// ─────────────────────────────────────────────────────────────
// Internal accessors
// ─────────────────────────────────────────────────────────────

function getVisualEditor(): Editor | null {
  if (testOverride) return testOverride.editor
  return bridgeRefs.visualRef?.current?.getEditor() ?? null
}

function getSourceView(): EditorView | null {
  if (testOverride) return testOverride.view
  return bridgeRefs.sourceRef?.current ?? null
}

function getMode(): EditorPaneMode {
  if (testOverride) return testOverride.mode
  return bridgeRefs.modeRef?.current ?? 'visual'
}

export function getBridgePaneMode(): EditorPaneMode {
  return getMode()
}

// ─────────────────────────────────────────────────────────────
// Editor context (read-only — no mutation)
// ─────────────────────────────────────────────────────────────

export function getBridgeEditorContext(): EditorContext {
  const mode = getMode()
  if (mode === 'visual') {
    const editor = getVisualEditor()
    if (editor) return buildVisualEditorContext(editor)
    return buildNullEditorContext('visual')
  }
  const view = getSourceView()
  if (view) return buildSourceEditorContext(view)
  return buildNullEditorContext('source')
}

// ─────────────────────────────────────────────────────────────
// Bridge capability queries (used by createTransaction for validation)
// ─────────────────────────────────────────────────────────────

export function bridgeHasVisualEditor(): boolean {
  return getVisualEditor() !== null
}

export function bridgeHasSourceView(): boolean {
  return getSourceView() !== null
}

/** Snapshot selection before top bar menu interaction (with preventDefault to prevent focus loss)*/
export function bridgeCaptureEditorSelection(): void {
  const mode = getMode()
  if (mode === 'visual') {
    const editor = getVisualEditor()
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from !== to) lastNonEmptySelection = { mode, from, to }
    pendingSelectionRestore = { mode, from, to }
    return
  }
  const view = getSourceView()
  if (!view) return
  const { from, to } = view.state.selection.main
  if (from !== to) lastNonEmptySelection = { mode, from, to }
  pendingSelectionRestore = { mode, from, to }
}

/** Persist the latest non-empty selection without scheduling an automatic restore on the next refocus. */
export function bridgeRememberCurrentSelection(): void {
  const mode = getMode()
  if (mode === 'visual') {
    const editor = getVisualEditor()
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from !== to) lastNonEmptySelection = { mode, from, to }
    return
  }
  const view = getSourceView()
  if (!view) return
  const { from, to } = view.state.selection.main
  if (from !== to) lastNonEmptySelection = { mode, from, to }
}

/** Restore the latest remembered non-empty selection if the current selection is empty. */
export function bridgeRestoreLastNonEmptySelection(): boolean {
  const saved = lastNonEmptySelection
  if (!saved || saved.from === saved.to) return false
  if (saved.mode !== getMode()) return false

  if (saved.mode === 'visual') {
    const editor = getVisualEditor()
    if (!editor || !editor.state.selection.empty) return false
    const docSize = editor.state.doc.content.size
    const from = Math.max(0, Math.min(saved.from, docSize))
    const to = Math.max(from, Math.min(saved.to, docSize))
    editor.commands.setTextSelection({ from, to })
    return true
  }

  const view = getSourceView()
  if (!view) return false
  const main = view.state.selection.main
  if (main.from !== main.to) return false
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(saved.from, docLen))
  const to = Math.max(from, Math.min(saved.to, docLen))
  view.dispatch({ selection: EditorSelection.range(from, to) })
  return true
}

function bridgeRestoreCapturedSelection(): void {
  const saved = pendingSelectionRestore
  pendingSelectionRestore = null
  if (!saved || saved.from === saved.to) return
  if (saved.mode !== getMode()) return

  if (saved.mode === 'visual') {
    const editor = getVisualEditor()
    if (!editor) return
    if (!editor.state.selection.empty) return
    const docSize = editor.state.doc.content.size
    const from = Math.max(0, Math.min(saved.from, docSize))
    const to = Math.max(from, Math.min(saved.to, docSize))
    editor.commands.setTextSelection({ from, to })
    return
  }

  const view = getSourceView()
  if (!view) return
  const main = view.state.selection.main
  if (main.from !== main.to) return
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(saved.from, docLen))
  const to = Math.max(from, Math.min(saved.to, docLen))
  view.dispatch({ selection: EditorSelection.range(from, to) })
}

/** Before the menu/shortcut keys trigger a command, bring the focus back to the current editing surface (to avoid the VM not being able to find the editor after clicking on the top bar)*/
export function bridgeRefocusActiveEditor(): void {
  bridgeRestoreCapturedSelection()
  if (getMode() === 'visual') {
    bridgeRefs.visualRef?.current?.focus()
    return
  }
  try {
    getSourceView()?.focus()
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────
// PRIMARY API: applyVMSteps — executes VMBridgeOp[] from vmReducer
//
// This is the bridge's primary mutation entry point.
// Called by commandTransaction after vmReduce() produces the op list.
// The bridge is a PURE EXECUTOR: no decision logic, no state reads for logic.
// ─────────────────────────────────────────────────────────────

export function applyVMSteps(ops: import('../vm/vmBridgeOps').VMBridgeOp[]): void {
  for (const op of ops) {
    executeVMBridgeOp(op)
  }
}

function executeVMBridgeOp(op: import('../vm/vmBridgeOps').VMBridgeOp): void {
  const FOCUS_NO_SCROLL = { scrollIntoView: false as const }

  switch (op.kind) {
    case 'setMark': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain()
        .focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .setMark(op.mark)
        .run()
      return
    }
    case 'unsetMark': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain()
        .focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .unsetMark(op.mark)
        .run()
      return
    }
    case 'ephemeralMark': {
      const editor = getVisualEditor()
      if (!editor) return
      runEphemeralCommand(editor, op.mark as EphemeralCommandType, {
        placeholder: op.placeholder,
        focusNoScroll: true,
      })
      return
    }
    case 'setHeading': {
      const editor = getVisualEditor()
      if (!editor) return
      if (op.level === 0) {
        editor.chain().focus(null, FOCUS_NO_SCROLL)
          .setTextSelection({ from: op.selection.from, to: op.selection.to })
          .setParagraph()
          .run()
      } else {
        editor.chain().focus(null, FOCUS_NO_SCROLL)
          .setTextSelection({ from: op.selection.from, to: op.selection.to })
          .setHeading({ level: op.level as 1|2|3|4|5|6 })
          .run()
      }
      return
    }
    case 'setParagraph': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .setParagraph()
        .run()
      return
    }
    case 'toggleBulletList': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .toggleBulletList()
        .run()
      return
    }
    case 'toggleOrderedList': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .toggleOrderedList()
        .run()
      return
    }
    case 'toggleTaskList': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .toggleTaskList()
        .run()
      return
    }
    case 'toggleBlockquote': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL)
        .setTextSelection({ from: op.selection.from, to: op.selection.to })
        .toggleBlockquote()
        .run()
      return
    }
    case 'insertHr': {
      const editor = getVisualEditor()
      if (!editor) return
      editor.chain().focus(null, FOCUS_NO_SCROLL).setHorizontalRule().run()
      return
    }
    case 'insertText': {
      const mode = getMode()
      if (mode === 'visual') {
        const editor = getVisualEditor()
        if (!editor) return
        const { from, to } = op.selection
        let state = editor.state
        if (from !== state.selection.from || to !== state.selection.to) {
          state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
        }
        const tr = applyPlainTextInsertion(state, op.text, 'command')
        editor.view.dispatch(tr.scrollIntoView())
        editor.commands.focus(null, FOCUS_NO_SCROLL)
      } else {
        const view = getSourceView()
        if (!view) return
        view.dispatch(view.state.replaceSelection(op.text))
      }
      return
    }
    case 'deleteSelection': {
      bridgeDeleteSelection()
      return
    }
    case 'cutSelection': {
      // Copy to clipboard, then delete
      const mode = getMode()
      if (mode === 'visual') {
        const editor = getVisualEditor()
        if (editor) {
          const selectedText = editor.state.doc.textBetween(op.selection.from, op.selection.to, '\n')
          void navigator.clipboard.writeText(selectedText)
        }
      } else {
        const view = getSourceView()
        if (view) {
          const text = view.state.sliceDoc(op.selection.from, op.selection.to)
          void navigator.clipboard.writeText(text)
        }
      }
      bridgeDeleteSelection()
      return
    }
    case 'insertCodeFence': {
      if (op.mode === 'source') {
        const view = getSourceView()
        if (view) insertCodeFenceForLang(op.language)(view)
      } else {
        const editor = getVisualEditor()
        if (editor) {
          editor.chain().focus(null, FOCUS_NO_SCROLL)
            .setCodeBlock({ language: op.language })
            .run()
        }
      }
      return
    }
    case 'sourceOp': {
      const view = getSourceView()
      if (view) executeBridgeSourceOp(view, op.op)
      return
    }
    case 'sourceEphemeral': {
      const view = getSourceView()
      if (view) runEphemeralSurround(view, op.mark)
      return
    }
    case 'tiptapCommand': {
      // Passthrough: complex commands that require runTiptapCommand's internal
      // logic (headingLevelDelta, callout, insertParagraphAbove/Below, etc.)
      bridgeRunTiptapCommand(op.command)
      return
    }
    default: {
      const _exhaustive: never = op
      void _exhaustive
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Legacy mutation functions — kept for backward compatibility during migration
// New code should call applyVMSteps() instead.
// ─────────────────────────────────────────────────────────────

export function bridgeRunTiptapCommand(command: TiptapEditorCommand): void {
  if (testOverride) return
  bridgeRefs.visualRef?.current?.runCommand(command)
}

export function bridgeRunTiptapEphemeral(mark: EphemeralCommandType, opts?: RunEphemeralOptions): void {
  const editor = getVisualEditor()
  if (!editor) return
  runEphemeralCommand(editor, mark, opts ?? { focusNoScroll: true })
}

export function bridgeRunSourceEphemeral(mark: EphemeralCommandType): void {
  const view = getSourceView()
  if (!view) return
  runEphemeralSurround(view, mark)
}

export function bridgeRunSourceOp(op: SourceEditorOp): void {
  const view = getSourceView()
  if (!view) return
  executeBridgeSourceOp(view, op)
}

export function bridgeWithSourceView<T>(fn: (view: EditorView) => T): T | null {
  const view = getSourceView()
  if (!view) return null
  return fn(view)
}

export function bridgeRunEditorCommand(
  command: TiptapEditorCommand,
  sourceFallback: (view: EditorView) => boolean,
): void {
  if (getMode() === 'visual') {
    bridgeRunTiptapCommand(command)
    bridgeRefs.visualRef?.current?.focus()
    return
  }
  const view = getSourceView()
  if (view) sourceFallback(view)
}

// ─────────────────────────────────────────────────────────────
// Clipboard operations (still document-mutating; channelled via bridge)
// ─────────────────────────────────────────────────────────────

export function bridgeDeleteSelection(): void {
  const mode = getMode()
  if (mode === 'visual') {
    bridgeRefs.visualRef?.current?.deleteSelection()
    return
  }
  const view = getSourceView()
  if (!view) return
  const { from, to } = view.state.selection.main
  if (from !== to) view.dispatch({ changes: { from, to, insert: '' } })
}

export function bridgeReplaceSelection(text: string): void {
  const mode = getMode()
  if (mode === 'visual') {
    bridgeRefs.visualRef?.current?.replaceSelection(text)
    return
  }
  const view = getSourceView()
  if (view) view.dispatch(view.state.replaceSelection(text))
}

export function bridgeInsertLiteralAtCursor(text: string): void {
  const view = getSourceView()
  if (!view) return
  const pos = view.state.selection.main.from
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: EditorSelection.cursor(pos + text.length),
  })
}

export function bridgeInsertImage(src: string, alt = 'image'): void {
  bridgeRefocusActiveEditor()
  if (getMode() === 'visual') {
    getVisualEditor()?.chain().focus().setImage({ src, alt }).run()
    bridgeRefs.visualRef?.current?.focus()
    return
  }
  const view = getSourceView()
  if (!view) return
  const escapedAlt = alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
  const insert = `![${escapedAlt}](${src})`
  const pos = view.state.selection.main.from
  view.dispatch({
    changes: { from: pos, insert },
    selection: EditorSelection.cursor(pos + insert.length),
  })
  view.focus()
}

// ─────────────────────────────────────────────────────────────
// Step-based undo/redo — called from commandTransaction only
// Replaces the removed snapshot-based bridgeApplySnapshot.
// ─────────────────────────────────────────────────────────────

/**
 * Visual-mode UNDO: apply PM inverted steps (captured by VmTiptapRecorder).
 * The inverted steps are already in application order (reversed from forward).
 */
export function bridgeApplyInvertedPmSteps(
  invertedSteps: readonly Step[],
  selectionBefore: { from: number; to: number },
): boolean {
  const editor = getVisualEditor()
  if (!editor || editor.isDestroyed || !editor.view) return false
  try {
    const tr = editor.state.tr.setMeta(VM_UNDO_META, true)
    for (const step of invertedSteps) {
      tr.step(step)
    }
    const maxPos = tr.doc.content.size
    const clampedFrom = Math.max(0, Math.min(selectionBefore.from, maxPos))
    const clampedTo = Math.max(0, Math.min(selectionBefore.to, maxPos))
    if (clampedFrom <= clampedTo) {
      tr.setSelection(TextSelection.create(tr.doc, clampedFrom, clampedTo))
    }
    editor.view.dispatch(tr)
    return true
  } catch {
    return false
  }
}

/**
 * Visual-mode REDO: re-apply the original forward PM steps.
 */
export function bridgeApplyForwardPmSteps(
  forwardSteps: readonly Step[],
  selectionAfter: { from: number; to: number },
): boolean {
  const editor = getVisualEditor()
  if (!editor) return false
  try {
    const tr = editor.state.tr.setMeta(VM_REDO_META, true)
    for (const step of forwardSteps) {
      tr.step(step)
    }
    const maxPos = tr.doc.content.size
    const clampedFrom = Math.max(0, Math.min(selectionAfter.from, maxPos))
    const clampedTo = Math.max(0, Math.min(selectionAfter.to, maxPos))
    if (clampedFrom <= clampedTo) {
      tr.setSelection(TextSelection.create(tr.doc, clampedFrom, clampedTo))
    }
    editor.view.dispatch(tr)
    return true
  } catch (e) {
    console.error('[VM] bridgeApplyForwardPmSteps failed:', e)
    return false
  }
}

/**
 * Source-mode UNDO: apply inverse ChangeSet (captured by VmCmRecorder).
 */
export function bridgeApplyInverseCmChanges(
  inverseChanges: ChangeSet,
  selectionBefore: { from: number; to: number },
): boolean {
  const view = getSourceView()
  if (!view) return false
  const maxPos = inverseChanges.newLength
  view.dispatch({
    changes: inverseChanges,
    selection: EditorSelection.range(
      Math.min(selectionBefore.from, maxPos),
      Math.min(selectionBefore.to, maxPos),
    ),
    annotations: [vmUndoAnnotation.of(true)],
  })
  return true
}

/**
 * Source-mode REDO: re-apply the original forward ChangeSet.
 */
export function bridgeApplyForwardCmChanges(
  forwardChanges: ChangeSet,
  selectionAfter: { from: number; to: number },
): boolean {
  const view = getSourceView()
  if (!view) return false
  const maxPos = forwardChanges.newLength
  view.dispatch({
    changes: forwardChanges,
    selection: EditorSelection.range(
      Math.min(selectionAfter.from, maxPos),
      Math.min(selectionAfter.to, maxPos),
    ),
    annotations: [vmRedoAnnotation.of(true)],
  })
  return true
}

// ─────────────────────────────────────────────────────────────
// UI operations (non-document-mutating; not tracked by VM)
// ─────────────────────────────────────────────────────────────

export function bridgeOpenSearchPanel(options?: { replace?: boolean }): void {
  const view = getSourceView()
  if (view) {
    openSearchPanel(view)
    return
  }
  bridgeRefs.visualRef?.current?.openSearchPanel(options)
}

export function bridgeReplaceNextInDocument(replacement?: string): boolean {
  const view = getSourceView()
  if (view) {
    replaceNext(view)
    return true
  }
  const visual = bridgeRefs.visualRef?.current
  if (!visual) return false
  if (!visual.openSearchPanel({ replace: true })) return false
  if (replacement != null) return visual.replaceSearchNext(replacement)
  return visual.replaceSearchNext('')
}

export function bridgeScrollToSelection(): void {
  const view = getSourceView()
  if (view) {
    scrollCodeMirrorViewToPos(view, view.state.selection.main.head, { select: false })
  }
}

// ─────────────────────────────────────────────────────────────
// Internal: Source op executor
// The ONLY place view.dispatch is called for structured operations
// ─────────────────────────────────────────────────────────────

function executeBridgeSourceOp(view: EditorView, op: SourceEditorOp): boolean {
  switch (op.kind) {
    case 'insert-code-fence':
      return insertCodeFenceForLang(op.language)(view)
    case 'insert-table':
      return insertMarkdownTable(view)
    case 'insert-link':
      return insertMarkdownLink(view)
    case 'insert-reference-def':
      return insertMarkdownReferenceDef(view)
    case 'open-emoji-picker':
      openLunaEmojiPickerFromSourceView(view)
      return true
    case 'insert-image':
      return insertMarkdownImage(view)
    case 'insert-prefix-line':
      return insertPrefixLine(op.prefix)(view)
    case 'insert-paragraph-above': {
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      view.dispatch({
        changes: { from: line.from, insert: '\n' },
        selection: EditorSelection.cursor(line.from + 1),
      })
      return true
    }
    case 'insert-paragraph-below': {
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      view.dispatch({
        changes: { from: line.to, insert: '\n' },
        selection: EditorSelection.cursor(line.to + 1),
      })
      return true
    }
    case 'surround-selection':
      return surroundSelection(op.left, op.right)(view)
    case 'strip-common-marks': {
      destroySourceEphemeralSession(view)
      const { from, to } = view.state.selection.main
      let t = view.state.doc.sliceString(from, to)
      t = t
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/<span\b[^>]*\bstyle\s*=\s*["'][^"']*color\s*:[^"']*["'][^>]*>/giu, '')
        .replace(/<\/span>/giu, '')
        .replace(/<\/?u\s*>/giu, '')
      view.dispatch({ changes: { from, to, insert: t } })
      return true
    }
    case 'insert-literal': {
      const pos = view.state.selection.main.head
      view.dispatch({
        changes: { from: pos, insert: op.text },
        selection: EditorSelection.cursor(pos + op.text.length),
      })
      return true
    }
    case 'indent-more':
      return indentMore(view)
    case 'indent-less':
      return indentLess(view)
    case 'toggle-task-done': {
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      const text = line.text
      const box = op.done ? '[x]' : '[ ]'
      const re = /^(\s*-\s+)\[[ xX]\](\s)/
      const m = text.match(re)
      if (!m) return false
      const next = text.replace(re, `${m[1]}${box}${m[2]}`)
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: next },
        selection: EditorSelection.cursor(line.from + next.length),
      })
      return true
    }
    case 'insert-table-row': {
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      if (!/^\s*\|.*\|\s*$/.test(line.text)) return false
      const row = '|  |  |'
      const insert = op.direction === 'above' ? `${row}\n` : `\n${row}`
      const pos = op.direction === 'above' ? line.from : line.to
      view.dispatch({
        changes: { from: pos, insert },
        selection: EditorSelection.cursor(pos + (op.direction === 'above' ? 2 : 3)),
      })
      return true
    }
    case 'heading-level-delta': {
      const line = view.state.doc.lineAt(view.state.selection.main.head)
      const text = line.text
      const match = /^(\s{0,3})(#{1,6})(\s)(.*)$/.exec(text)
      if (!match) return false
      const level = match[2].length
      const nextLevel = Math.max(1, Math.min(6, level + op.delta))
      const next = `${match[1]}${'#'.repeat(nextLevel)}${match[3]}${match[4]}`
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: next },
        selection: EditorSelection.cursor(view.state.selection.main.head + (next.length - text.length)),
      })
      return true
    }
    case 'delete-selection': {
      const { from, to } = view.state.selection.main
      if (from === to) return deleteCharBackward(view)
      view.dispatch({ changes: { from, to, insert: '' } })
      return true
    }
    case 'delete-line':
      return deleteLine(view)
    case 'select-all':
      return selectAll(view)
    case 'select-block':
      return selectParentSyntax(view) || selectLine(view)
    default: {
      const _exhaustive: never = op
      void _exhaustive
      return false
    }
  }
}
