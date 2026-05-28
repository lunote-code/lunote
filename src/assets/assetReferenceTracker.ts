import {
  extractAssetIdsFromMarkdown,
  getAssetGraphSnapshot,
  syncAssetGraphStatsToIndex,
  updateDocumentAssetReferences,
} from './assetGraph'
import { getActiveAssetWorkspace } from './workspaceAssetStore'

const liveReferences = new Map<string, Set<string>>()
const timers = new Map<string, number>()

export function updateReferences(docPath: string, content: string): void {
  const nextRefs = new Set(extractAssetIdsFromMarkdown(content))
  const prevRefs = liveReferences.get(docPath)
  if (setsEqual(prevRefs, nextRefs)) return

  liveReferences.set(docPath, nextRefs)
  updateDocumentAssetReferences(docPath, [...nextRefs])
  void syncAssetGraphStatsToIndex(getActiveAssetWorkspace()).catch((error) => {
    console.error('[ASSET REF] sync failed', error)
  })
}

export function scheduleReferenceUpdate(
  docPath: string,
  content: string,
  debounceMs = 350,
): void {
  const existing = timers.get(docPath)
  if (existing != null) window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    timers.delete(docPath)
    updateReferences(docPath, content)
  }, debounceMs)
  timers.set(docPath, timer)
}

export function getLiveReferences(docPath: string): string[] {
  return [...(liveReferences.get(docPath) ?? [])]
}

export function getTrackedAssetReferenceSnapshot() {
  return getAssetGraphSnapshot()
}

/** Release per-document asset reference tracking when a tab is closed. */
export function removeDocumentReferences(docPath: string): void {
  if (!docPath) return
  const existing = timers.get(docPath)
  if (existing != null) {
    window.clearTimeout(existing)
    timers.delete(docPath)
  }
  liveReferences.delete(docPath)
}

export function resetAssetReferenceTracker(): void {
  for (const timer of timers.values()) window.clearTimeout(timer)
  timers.clear()
  liveReferences.clear()
}

function setsEqual(a: Set<string> | undefined, b: Set<string>): boolean {
  if (!a || a.size !== b.size) return false
  for (const item of b) {
    if (!a.has(item)) return false
  }
  return true
}
