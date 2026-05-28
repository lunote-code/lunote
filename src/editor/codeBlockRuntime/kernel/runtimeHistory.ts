import type { RuntimeSnapshot } from './runtimeSnapshot'
import { createRuntimeSnapshot, snapshotDiffers } from './runtimeSnapshot'

const MAX_HISTORY = 48
const snapshots: RuntimeSnapshot[] = []
let historyIndex = -1

export function pushRuntimeSnapshot(snapshot?: RuntimeSnapshot): RuntimeSnapshot {
  const next = snapshot ?? createRuntimeSnapshot()
  const current = snapshots[historyIndex]
  if (current && !snapshotDiffers(current, next)) {
    return next
  }

  if (historyIndex < snapshots.length - 1) {
    snapshots.splice(historyIndex + 1)
  }

  snapshots.push(next)
  historyIndex = snapshots.length - 1

  if (snapshots.length > MAX_HISTORY) {
    const overflow = snapshots.length - MAX_HISTORY
    snapshots.splice(0, overflow)
    historyIndex = Math.max(0, historyIndex - overflow)
  }

  return next
}

export function peekRuntimeSnapshot(): RuntimeSnapshot | undefined {
  return historyIndex >= 0 ? snapshots[historyIndex] : undefined
}

export function undoRuntimeSnapshot(): RuntimeSnapshot | undefined {
  if (historyIndex <= 0) return undefined
  historyIndex -= 1
  return snapshots[historyIndex]
}

export function redoRuntimeSnapshot(): RuntimeSnapshot | undefined {
  if (historyIndex >= snapshots.length - 1) return undefined
  historyIndex += 1
  return snapshots[historyIndex]
}

export function clearRuntimeHistory(): void {
  snapshots.length = 0
  historyIndex = -1
}

export function getRuntimeHistorySize(): number {
  return snapshots.length
}

export function getRuntimeHistoryIndex(): number {
  return historyIndex
}
