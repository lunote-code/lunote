/**
 * Command+/ Logic bridge when switching between WYSIWYG ↔ Full document source code.
 * The viewport is derived from the **selection**: CodeMirror uses the `EditorView.scrollIntoView` effect; ProseMirror uses `Transaction.scrollIntoView()`,
 * They are all in the same transaction/same `dispatch` as the selection change, and this type does not carry heuristic fields such as scrollRatio.
 *
 * The CM subscript is **transport encoding**; the **hierarchical anchor `hierarchical`** is the semantic truth value (block + intra-block semantic offset).
 * **Source→Visual**: Prioritize `hierarchical` precise positioning; if missing, it will be downgraded by the enhancement layer, **not blocking** UI mode switching.
 */

import type { HierarchicalSelectionCore } from './modeSwitchSelectionCore'
import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'
import type { ModeSwitchSnapshot } from './modeSwitchSnapshot'

export type ModeSwitchPrepareResultKind = 'strict_success' | 'degraded_success' | 'hard_fail'

export type HierarchicalSelectionAnchor = HierarchicalSelectionCore

export type ModeSwitchHierarchicalPayload = {
  bufferHash: string
  anchor: HierarchicalSelectionAnchor
  head: HierarchicalSelectionAnchor
}

/** Weak fingerprint aligned with `content`/CM buffer for rejecting stale hierarchical anchors*/
export function modeSwitchBufferFingerprint(md: string): string {
  return modeSwitchPlainTextFingerprint(md)
}

export type SourceModeEnterAnchor = {
  /** Document identification at the moment of switching to prevent misuse of anchor points after changing tags/asynchronously*/
  documentKey: string
  /** The source code buffer length corresponding to `cmAnchor`/`cmHead` (must be consistent with CodeMirror `doc.length`)*/
  bufferLength: number
  /** Debug: logical bridge id, non-DOM nodeId*/
  bridgeId: string
  cmAnchor: number
  cmHead: number
  /** The rendering transaction frame id of the same capture as `hierarchical` (monotonically increasing)*/
  captureFrameId?: number
  /** Hierarchical semantic anchor (block + within block); when present, Visual→Source / Source→Visual only recognizes this truth*/
  hierarchical?: ModeSwitchHierarchicalPayload
  /** Single ⌘/ freeze snapshot; pipeline only consumes this object when it exists*/
  modeSwitchSnapshot?: ModeSwitchSnapshot
  /** Explicitly marks whether this source-enter anchor is strict or degraded.*/
  resultKind?: Exclude<ModeSwitchPrepareResultKind, 'hard_fail'>
  /** YAML prefix length when leaving visual; stabilizes scroll/offset maps if YAML edits later in source.*/
  frontmatterPrefixLengthAtCapture?: number
}

export type VisualModeRestorePayload = {
  documentKey: string
  bufferLength: number
  bridgeId: string
  cmAnchor: number
  cmHead: number
  /** Monotone frame id at the same generation time as `hierarchical`; Source→Visual discards expired async*/
  captureFrameId?: number
  hierarchical?: ModeSwitchHierarchicalPayload | null
  /** Source→Visual restore frozen snapshot (same chain as `pending.modeSwitchSnapshot`)*/
  modeSwitchSnapshot?: ModeSwitchSnapshot | null
  /** Explicitly marks whether this visual restore is strict or degraded.*/
  resultKind: Exclude<ModeSwitchPrepareResultKind, 'hard_fail'>
}

export function makeModeBridgeId(documentKey: string, cmAnchor: number, cmHead: number): string {
  return `bridge:${documentKey}#${cmAnchor}:${cmHead}`
}
