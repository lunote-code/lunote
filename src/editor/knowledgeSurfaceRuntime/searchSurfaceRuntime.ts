import { searchSemanticAsync } from '../knowledgeInteractionRuntime'
import { registerSurfaceRecord, transitionSurfacePhase } from './surfaceLifecycle'
import { scheduleSurfaceTask, cancelSurfaceTasksByPrefix } from './surfaceScheduler'
import { computeVirtualWindow, sliceVirtualItems, virtualizeSurface } from './surfaceVirtualization'
import type { SemanticSearchResult } from '../knowledgeInteractionRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

export type SearchSurfaceSnapshot = {
  surfaceId: string
  query: string
  revision: number
  results: SemanticSearchResult[]
  virtualWindow: { start: number; end: number }
  loading: boolean
}

const snapshots = new Map<string, SearchSurfaceSnapshot>()
const listeners = new Set<() => void>()
let searchSeq = 0

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeSearchSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function mountSearchSurface(contextDocKey?: DocKey): string {
  const surfaceId = `search-${++searchSeq}`
  registerSurfaceRecord(surfaceId, 'search-panel', { docKey: contextDocKey ?? null })
  transitionSurfacePhase(surfaceId, 'visible')
  snapshots.set(surfaceId, {
    surfaceId,
    query: '',
    revision: 0,
    results: [],
    virtualWindow: { start: 0, end: 0 },
    loading: false,
  })
  return surfaceId
}

export function updateSearchQuery(
  surfaceId: string,
  query: string,
  contextDocKey?: DocKey,
  scrollTop = 0,
): void {
  cancelSurfaceTasksByPrefix(`search-query:${surfaceId}`)
  const prev = snapshots.get(surfaceId)
  snapshots.set(surfaceId, {
    ...(prev ?? {
      surfaceId,
      query: '',
      revision: 0,
      results: [],
      virtualWindow: { start: 0, end: 0 },
      loading: false,
    }),
    query,
    loading: true,
    revision: (prev?.revision ?? 0) + 1,
  })
  notify()

  scheduleSurfaceTask({
    key: `search-query:${surfaceId}:${query}`,
    kind: 'search',
    priority: query.length < 2 ? 'idle' : 'interaction',
    run: async () => {
      const results = await searchSemanticAsync(query, {
        limit: 80,
        contextDocKey,
      })
      const win = computeVirtualWindow(scrollTop, 36, 480, results.length, 8)
      virtualizeSurface(surfaceId, win)
      snapshots.set(surfaceId, {
        surfaceId,
        query,
        revision: (snapshots.get(surfaceId)?.revision ?? 0) + 1,
        results,
        virtualWindow: { start: win.start, end: win.end },
        loading: false,
      })
      notify()
    },
  })
}

export function getSearchSurfaceSnapshot(surfaceId: string): SearchSurfaceSnapshot | null {
  return snapshots.get(surfaceId) ?? null
}

export function getVirtualizedSearchResults(surfaceId: string): SemanticSearchResult[] {
  const snap = snapshots.get(surfaceId)
  if (!snap) return []
  const win = computeVirtualWindow(0, 36, 480, snap.results.length, 8)
  return sliceVirtualItems(snap.results, win)
}

export function resetSearchSurfaceRuntime(): void {
  snapshots.clear()
  listeners.clear()
  searchSeq = 0
}
