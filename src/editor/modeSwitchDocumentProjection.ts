import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

import { modeSwitchPlainTextFingerprint } from './modeSwitchFingerprint'

/** Consistent with `canonicalBuffer` fingerprint + PM root size during freeze; **No** runtime re-serialization verification.*/
export type ModeSwitchDocumentIdentity = {
  readonly bufferHash: string
  readonly pmInnerSize: number
}

/** Equivalent to `.size` of fragment under PM `doc` root.*/
export function pmRootInnerSize(node: ProseMirrorNode): number {
  let total = 0
  const n = node.childCount
  for (let i = 0; i < n; i += 1) {
    total += node.child(i).nodeSize
  }
  return total
}

export function buildModeSwitchDocumentIdentity(
  canonicalBuffer: string,
  doc: ProseMirrorNode,
): ModeSwitchDocumentIdentity {
  return Object.freeze({
    bufferHash: modeSwitchPlainTextFingerprint(canonicalBuffer),
    pmInnerSize: pmRootInnerSize(doc),
  })
}

/**
 * Phase3: Structural scalar comparison only - **disable** calling `serializeDocToMarkdownForModeBridge` on live `doc`.
 * When `bufferHash` is freeze, the fingerprint is frozen; the apply path does not reconstruct the second text truth value.
 */
export function livePmDocMatchesFrozenIdentity(args: {
  doc: ProseMirrorNode
  frozen: ModeSwitchDocumentIdentity
}): boolean {
  return pmRootInnerSize(args.doc) === args.frozen.pmInnerSize
}

/** `coordsAtPos` / Before viewport scrolling: Clamp the frozen PM coordinates to the legal range of the current `doc.content` (no projection semantics).*/
export function clampPmPosForModeSwitchViewport(doc: ProseMirrorNode, pos: number): number {
  if (!Number.isFinite(pos)) return 0
  const max = doc.content.size
  const p = Math.round(pos)
  if (max <= 0) return 0
  return Math.min(Math.max(p, 1), max)
}

/** DEV: The live PM must be consistent with the frozen `documentIdentity` and selection coordinates before recovery, otherwise the recovery chain will be aborted.*/
export function assertRestoreSnapshotMatchesLivePmDocDev(args: {
  doc: ProseMirrorNode
  frozen: ModeSwitchDocumentIdentity
  expectedPmAnchor: number
  expectedPmHead: number
  documentKey: string
  restoreGen: number
}): void {
  if (!import.meta.env.DEV) return
  const live = pmRootInnerSize(args.doc)
  if (live !== args.frozen.pmInnerSize) {
     
    console.error('[mode-switch] assertRestoreSnapshotMatchesLivePmDocDev: pmInnerSize mismatch', {
      documentKey: args.documentKey,
      restoreGen: args.restoreGen,
      live,
      frozen: args.frozen.pmInnerSize,
    })
    throw new Error('[mode-switch] PM doc not ready for frozen snapshot')
  }
  const max = args.doc.content.size
  if (max < 1) return
  for (const label of ['anchor', 'head'] as const) {
    const p = label === 'anchor' ? args.expectedPmAnchor : args.expectedPmHead
    if (!Number.isFinite(p) || p < 1 || p > max) {
       
      console.error('[mode-switch] assertRestoreSnapshotMatchesLivePmDocDev: illegal PM coord', {
        documentKey: args.documentKey,
        restoreGen: args.restoreGen,
        label,
        p,
        max,
      })
      throw new Error('[mode-switch] illegal frozen PM selection coord')
    }
  }
}

/** Only used if `livePmDocMatchesFrozenIdentity` is true: the selection coordinates come from the snapshot, without live selection.*/
export function textSelectionFromFrozenPmProjection(args: {
  doc: ProseMirrorNode
  expectedPmAnchor: number
  expectedPmHead: number
}): TextSelection {
  return TextSelection.fromJSON(args.doc, {
    type: 'text',
    anchor: args.expectedPmAnchor,
    head: args.expectedPmHead,
  }) as TextSelection
}

export type ModeSwitchPmSelectionPayload = {
  documentIdentity: ModeSwitchDocumentIdentity
  expectedPmAnchor: number
  expectedPmHead: number
}

/**
 * Write frozen PM selection to view: `TextSelection.fromJSON` + `documentIdentity` structure validation (no runtime serialize).
 */
export function applyPmSelectionFromFrozenProjection(args: {
  view: EditorView
  schema: Schema
  snapshot: ModeSwitchPmSelectionPayload
}): { ok: true } | { ok: false; reason: 'projection_mismatch' | 'selection_invalid' } {
  const doc = args.view.state.doc
  if (!livePmDocMatchesFrozenIdentity({ doc, frozen: args.snapshot.documentIdentity })) {
     
    console.error('[mode-switch] PM doc not ready (applyPmSelectionFromFrozenProjection)', {
      live: pmRootInnerSize(doc),
      frozen: args.snapshot.documentIdentity.pmInnerSize,
    })
    return { ok: false, reason: 'projection_mismatch' }
  }
  try {
    const sel = textSelectionFromFrozenPmProjection({
      doc,
      expectedPmAnchor: args.snapshot.expectedPmAnchor,
      expectedPmHead: args.snapshot.expectedPmHead,
    })
    args.view.dispatch(args.view.state.tr.setSelection(sel))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'selection_invalid' }
  }
}
