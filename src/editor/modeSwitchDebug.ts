import type { ModeSwitchSnapshot } from './modeSwitchSnapshot'
import {
  summarizeModeSwitchAnchorQuality,
} from './modeSwitchQualitySignals'

export type LineCol = {
  line: number
  column: number
}

export function offsetToLineCol(text: string, offset: number): LineCol {
  const clamped = Math.max(0, Math.min(offset, text.length))
  let line = 1
  let lastLineStart = 0
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1
      lastLineStart = i + 1
    }
  }
  return {
    line,
    column: clamped - lastLineStart + 1,
  }
}

export function describeSelectionInText(
  text: string,
  anchor: number,
  head: number,
): {
  anchor: { offset: number; line: number; column: number }
  head: { offset: number; line: number; column: number }
} {
  const a = offsetToLineCol(text, anchor)
  const h = offsetToLineCol(text, head)
  return {
    anchor: { offset: anchor, line: a.line, column: a.column },
    head: { offset: head, line: h.line, column: h.column },
  }
}

export function describeScrollMetrics(
  el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'> | null | undefined,
): {
  top: number | null
  max: number | null
  ratio: number | null
  height: number | null
  scrollHeight: number | null
} {
  if (!el) {
    return { top: null, max: null, ratio: null, height: null, scrollHeight: null }
  }
  const top = Number.isFinite(el.scrollTop) ? el.scrollTop : null
  const height = Number.isFinite(el.clientHeight) ? el.clientHeight : null
  const scrollHeight = Number.isFinite(el.scrollHeight) ? el.scrollHeight : null
  const max =
    height != null && scrollHeight != null ? Math.max(0, scrollHeight - height) : null
  const ratio = top != null && max != null && max > 0 ? top / max : max === 0 ? 0 : null
  return { top, max, ratio, height, scrollHeight }
}

export function summarizeSnapshot(snapshot: ModeSwitchSnapshot | null | undefined): Record<string, unknown> | null {
  if (!snapshot) return null
  return {
    sourceMode: snapshot.sourceMode,
    docHash: snapshot.documentIdentity.bufferHash,
    captureFrameId: snapshot.captureFrameId,
    cmSelection: describeSelectionInText(
      snapshot.canonicalBuffer,
      snapshot.selection.anchor,
      snapshot.selection.head,
    ),
    expectedPm: {
      anchor: snapshot.expectedPmAnchor,
      head: snapshot.expectedPmHead,
    },
    hierarchical: snapshot.hierarchical
      ? {
          anchorBlock: snapshot.hierarchical.anchor.blockIndex,
          anchorRowKey: snapshot.hierarchical.anchor.rowKey,
          anchorBlockPath: snapshot.hierarchical.anchor.blockPath.join('.'),
          anchorIntra: snapshot.hierarchical.anchor.intraBlockOffset,
          headBlock: snapshot.hierarchical.head.blockIndex,
          headRowKey: snapshot.hierarchical.head.rowKey,
          headBlockPath: snapshot.hierarchical.head.blockPath.join('.'),
          headIntra: snapshot.hierarchical.head.intraBlockOffset,
        }
      : null,
    quality: snapshot.hierarchical
      ? {
          anchor: summarizeModeSwitchAnchorQuality(snapshot.frozenStructuralIR, snapshot.hierarchical.anchor),
          head: summarizeModeSwitchAnchorQuality(snapshot.frozenStructuralIR, snapshot.hierarchical.head),
        }
      : null,
    blockCount: snapshot.frozenStructuralIR.blocks.length,
  }
}

export function debugModeSwitch(label: string, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  console.debug(label, payload)
}
