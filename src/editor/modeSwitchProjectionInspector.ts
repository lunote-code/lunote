/**
 * ModeSwitch Projection Divergence Inspector
 *
 * Rules: Observations, diffs, DEV logs only; **No** modifications to selection logic, viewport engine, or snapshot system.
 * Phase2: Do not do `serializeDocToMarkdownForModeBridge` on live PM in this module (avoid runtime second serialization true value).
 */

import type { Schema } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

import { pmRootInnerSize } from './modeSwitchDocumentProjection'
import type { ModeSwitchSnapshot } from './modeSwitchSnapshot'

export type PmCaretCoords = { top: number; bottom: number }

function readPmSelection(state: EditorState): { anchor: number; head: number } {
  return { anchor: state.selection.anchor, head: state.selection.head }
}

export function coordsCenterY(c: PmCaretCoords | null | undefined): number | null {
  if (!c) return null
  return (c.top + c.bottom) / 2
}

export function diffCoordsY(before: PmCaretCoords | null, after: PmCaretCoords | null): number | null {
  const y0 = coordsCenterY(before)
  const y1 = coordsCenterY(after)
  if (y0 == null || y1 == null) return null
  return y1 - y0
}

export function resolvedDepthAt(doc: EditorState['doc'], pos: number): number | null {
  try {
    return doc.resolve(Math.min(Math.max(pos, 0), doc.content.size)).depth
  } catch {
    return null
  }
}

function readPmScrollerScrollTop(view: EditorView): number | null {
  const dom = view.dom as HTMLElement
  const t = dom.scrollTop
  return Number.isFinite(t) ? t : null
}

/**
 * ModeSwitch Projection Divergence Inspector: Observe /diff / DEV logs only, MUST NOT change selection, viewport or snapshot semantics.
 */
export type ModeSwitchVisualRestoreInspectCtx = {
  snapshot: ModeSwitchSnapshot
  selBeforeApply: { anchor: number; head: number }
  /** Phase2: Do not serialize live doc in inspector; always `null`*/
  liveDocHash: string | null
  livePmInnerSize: number
  frozenPmInnerSize: number
  /** Phase2: Do not compare live canonical here; always `null`*/
  canonicalDriftScore: number | null
  snapshotDocHash: string
  coordsAtFrozenHeadBeforeApply: PmCaretCoords | null
  appliedOk: boolean | null
  applyReason: string | null
  selAfterApply: { anchor: number; head: number } | null
  deltaExpectedVsLiveAfterApply: { dAnchor: number; dHead: number } | null
  deltaTransactionApply: { dAnchor: number; dHead: number } | null
  resolvedDepthDiffAfterApply: number | null
  coordsAtFrozenHeadPreViewport: PmCaretCoords | null
  scrollTopPreViewport: number | null
  coordsAtFrozenHeadPostViewport: PmCaretCoords | null
  scrollTopPostViewport: number | null
  scrollDelta: number | null
  coordsYDeltaViewport: number | null
}

export function startVisualRestoreInspection(
  view: EditorView,
  _schema: Schema,
  snapshot: ModeSwitchSnapshot,
): ModeSwitchVisualRestoreInspectCtx {
  const st = view.state
  return {
    snapshot,
    selBeforeApply: readPmSelection(st),
    liveDocHash: null,
    livePmInnerSize: pmRootInnerSize(st.doc),
    frozenPmInnerSize: snapshot.documentIdentity.pmInnerSize,
    canonicalDriftScore: null,
    snapshotDocHash: snapshot.documentIdentity.bufferHash,
    coordsAtFrozenHeadBeforeApply: view.coordsAtPos(snapshot.expectedPmHead),
    appliedOk: null,
    applyReason: null,
    selAfterApply: null,
    deltaExpectedVsLiveAfterApply: null,
    deltaTransactionApply: null,
    resolvedDepthDiffAfterApply: null,
    coordsAtFrozenHeadPreViewport: null,
    scrollTopPreViewport: null,
    coordsAtFrozenHeadPostViewport: null,
    scrollTopPostViewport: null,
    scrollDelta: null,
    coordsYDeltaViewport: null,
  }
}

export function recordPostApplyInspection(
  ctx: ModeSwitchVisualRestoreInspectCtx,
  view: EditorView,
  result: { ok: true } | { ok: false; reason: string },
): void {
  ctx.appliedOk = result.ok
  ctx.applyReason = result.ok ? null : result.reason
  if (!result.ok) {
    ctx.selAfterApply = null
    ctx.deltaExpectedVsLiveAfterApply = null
    ctx.deltaTransactionApply = null
    ctx.resolvedDepthDiffAfterApply = null
    return
  }
  const st = view.state
  const after = readPmSelection(st)
  ctx.selAfterApply = after
  ctx.deltaExpectedVsLiveAfterApply = {
    dAnchor: after.anchor - ctx.snapshot.expectedPmAnchor,
    dHead: after.head - ctx.snapshot.expectedPmHead,
  }
  ctx.deltaTransactionApply = {
    dAnchor: after.anchor - ctx.selBeforeApply.anchor,
    dHead: after.head - ctx.selBeforeApply.head,
  }
  const dExp = resolvedDepthAt(st.doc, ctx.snapshot.expectedPmAnchor)
  const dAct = resolvedDepthAt(st.doc, after.anchor)
  ctx.resolvedDepthDiffAfterApply = dExp != null && dAct != null ? Math.abs(dAct - dExp) : null
}

export function recordPreViewportInspection(ctx: ModeSwitchVisualRestoreInspectCtx, view: EditorView): void {
  ctx.coordsAtFrozenHeadPreViewport = view.coordsAtPos(ctx.snapshot.expectedPmHead)
  ctx.scrollTopPreViewport = readPmScrollerScrollTop(view)
}

export function recordPostViewportInspection(ctx: ModeSwitchVisualRestoreInspectCtx, view: EditorView): void {
  ctx.coordsAtFrozenHeadPostViewport = view.coordsAtPos(ctx.snapshot.expectedPmHead)
  ctx.scrollTopPostViewport = readPmScrollerScrollTop(view)
  const st = ctx.scrollTopPreViewport
  const en = ctx.scrollTopPostViewport
  ctx.scrollDelta = st != null && en != null ? en - st : null
  ctx.coordsYDeltaViewport = diffCoordsY(ctx.coordsAtFrozenHeadPreViewport, ctx.coordsAtFrozenHeadPostViewport)
}

export function logModeSwitchProjectionInspectLines(ctx: ModeSwitchVisualRestoreInspectCtx, bridgeId: string): void {
  if (!import.meta.env.DEV) return
   
  console.debug(`[inspect] snapshot hash ${ctx.snapshotDocHash}`)
   
  console.debug(`[inspect] live doc hash (suppressed Phase2) ${ctx.liveDocHash}`)
  const selDelta = {
    expectedVsLive: ctx.deltaExpectedVsLiveAfterApply,
    transaction: ctx.deltaTransactionApply,
  }
   
  console.debug(`[inspect] selection delta ${JSON.stringify(selDelta)}`)
   
  console.debug(`[inspect] canonical drift score (suppressed Phase2) ${ctx.canonicalDriftScore}`)
   
  console.debug('[inspect] detail', {
    bridgeId,
    frozenInner: ctx.frozenPmInnerSize,
    liveInner: ctx.livePmInnerSize,
    applyOk: ctx.appliedOk,
    applyReason: ctx.applyReason,
    resolvedDepthDiffAfterApply: ctx.resolvedDepthDiffAfterApply,
    coordsYDeltaViewport: ctx.coordsYDeltaViewport,
    scrollDelta: ctx.scrollDelta,
    coordsBeforeApply: ctx.coordsAtFrozenHeadBeforeApply,
    coordsPreViewport: ctx.coordsAtFrozenHeadPreViewport,
    coordsPostViewport: ctx.coordsAtFrozenHeadPostViewport,
  })
}
