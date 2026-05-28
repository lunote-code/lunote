import type { SelectionSnapshot } from '../selectionSnapshot'
import { captureSelection, clipboardTextFromValue, createSelectionSnapshot } from '../selectionSnapshot'
import { getFrameIndex } from './selectionFrameScheduler'

export type StableSnapshot = SelectionSnapshot & {
  valueAtCapture: string
  clipboardText: string
}

/**
 * Freeze value + clipboard text before mutation, and do not read live selection later.
 */
export function ensureStableSnapshot(el: HTMLTextAreaElement): StableSnapshot {
  const valueAtCapture = el.value
  const start = el.selectionStart
  const end = el.selectionEnd
  const clipboardText = clipboardTextFromValue(valueAtCapture, start, end)
  const frameIndex = getFrameIndex(el)
  const base = createSelectionSnapshot(valueAtCapture, start, end, {
    frameIndex,
    valueAtCapture,
    clipboardText,
  })
  return {
    ...base,
    valueAtCapture,
    clipboardText,
  }
}

export function stableSnapshotFromCapture(el: HTMLTextAreaElement): StableSnapshot {
  const snap = captureSelection(el, getFrameIndex(el))
  const valueAtCapture = snap.valueAtCapture ?? el.value
  const clipboardText =
    snap.clipboardText ?? clipboardTextFromValue(valueAtCapture, snap.start, snap.end)
  return {
    ...snap,
    valueAtCapture,
    clipboardText,
  }
}

export function clipboardTextFromStable(snapshot: StableSnapshot): string {
  return snapshot.clipboardText
}
