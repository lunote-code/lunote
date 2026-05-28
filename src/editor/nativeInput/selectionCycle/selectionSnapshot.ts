export type SelectionSnapshot = {
  start: number
  end: number
  valueHash: string
  timestamp: number
  /** v2: Capture frame sequence number*/
  frameIndex?: number
  /** v2: value frozen on capture, clipboard/restore does not read live DOM*/
  valueAtCapture?: string
  /** v2: Clipboard text determined at capture time*/
  clipboardText?: string
}

export function hashTextareaValue(value: string): string {
  let h = 5381
  for (let i = 0; i < value.length; i++) {
    h = (h * 33) ^ value.charCodeAt(i)
  }
  return `${value.length}:${h >>> 0}`
}

export function clipboardTextFromValue(value: string, start: number, end: number): string {
  if (start !== end) return value.slice(start, end)
  return value
}

export function createSelectionSnapshot(
  value: string,
  start: number,
  end: number,
  extras?: Pick<SelectionSnapshot, 'frameIndex' | 'valueAtCapture' | 'clipboardText'>,
): SelectionSnapshot {
  return {
    start,
    end,
    valueHash: hashTextareaValue(value),
    timestamp: performance.now(),
    valueAtCapture: value,
    clipboardText: clipboardTextFromValue(value, start, end),
    ...extras,
  }
}

export function captureSelection(
  el: HTMLTextAreaElement,
  frameIndex?: number,
): SelectionSnapshot {
  const value = el.value
  const start = el.selectionStart
  const end = el.selectionEnd
  return createSelectionSnapshot(value, start, end, { frameIndex })
}

export function restoreSelection(el: HTMLTextAreaElement, snapshot: SelectionSnapshot): boolean {
  const len = el.value.length
  const start = Math.max(0, Math.min(snapshot.start, len))
  const end = Math.max(start, Math.min(snapshot.end, len))
  if (el.selectionStart === start && el.selectionEnd === end) return true
  try {
    el.setSelectionRange(start, end)
    return true
  } catch {
    return false
  }
}

/** Prioritize using snapshot to freeze text to avoid live DOM race*/
export function textFromSnapshot(_el: HTMLTextAreaElement, snapshot: SelectionSnapshot): string {
  if (snapshot.clipboardText != null) return snapshot.clipboardText
  const value = snapshot.valueAtCapture ?? _el.value
  return clipboardTextFromValue(value, snapshot.start, snapshot.end)
}

export function snapshotMatchesValue(el: HTMLTextAreaElement, snapshot: SelectionSnapshot): boolean {
  return hashTextareaValue(el.value) === snapshot.valueHash
}

export function reconcileSnapshotForRestore(
  el: HTMLTextAreaElement,
  target: SelectionSnapshot,
): SelectionSnapshot {
  if (snapshotMatchesValue(el, target)) return target
  const len = el.value.length
  return {
    ...target,
    start: Math.min(target.start, len),
    end: Math.min(target.end, len),
    valueHash: hashTextareaValue(el.value),
    valueAtCapture: el.value,
  }
}
