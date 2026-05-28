import { getKnowledgeRegistryRevision, getVaultRootDir, searchKnowledgeAsync } from '../knowledgeRuntime'
import type { DocKey, SearchHit } from '../knowledgeRuntime/types'
import { searchNotesBackend } from '../../lib/noteSearch'
import type { KnowledgeSearchSnapshot } from './types'

const searchCache = new Map<string, { hits: SearchHit[]; registryRev: number; at: number }>()
const CACHE_TTL_MS = 30_000

let snapshot: KnowledgeSearchSnapshot = {
  query: '',
  hits: [],
  loading: false,
  revision: 0,
}

const listeners = new Set<() => void>()
let searchToken = 0

function cacheKey(query: string, tag?: string, backlinkOf?: DocKey): string {
  return `${query}|${tag ?? ''}|${backlinkOf ?? ''}`
}

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function getKnowledgeSearchSnapshot(): Readonly<KnowledgeSearchSnapshot> {
  return snapshot
}

export function subscribeKnowledgeSearch(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function runKnowledgeSearch(
  query: string,
  options?: { limit?: number; tag?: string; backlinkOf?: DocKey },
): Promise<SearchHit[]> {
  const token = ++searchToken
  const limit = options?.limit ?? 50
  const key = cacheKey(query, options?.tag, options?.backlinkOf)
  const rev = getKnowledgeRegistryRevision()
  const cached = searchCache.get(key)
  const now = performance.now()

  if (
    cached &&
    cached.registryRev === rev &&
    now - cached.at < CACHE_TTL_MS &&
    query === snapshot.query
  ) {
    snapshot = { query, hits: cached.hits, loading: false, revision: snapshot.revision + 1 }
    notify()
    return cached.hits
  }

  snapshot = { query, hits: snapshot.hits, loading: true, revision: snapshot.revision + 1 }
  notify()

  const knowledgeHits = await searchKnowledgeAsync(query, {
    limit,
    tag: options?.tag,
    backlinkOf: options?.backlinkOf,
  })

  let hits = knowledgeHits
  if (!options?.tag && !options?.backlinkOf) {
    const root = getVaultRootDir()?.replace(/[/\\]+$/u, '') ?? ''
    const ftsHits = await searchNotesBackend(root, query, limit)
    const merged = new Map<string, SearchHit>()
    for (const hit of ftsHits) merged.set(hit.docKey, hit)
    for (const hit of knowledgeHits) {
      const prev = merged.get(hit.docKey)
      if (!prev || hit.score > prev.score) merged.set(hit.docKey, hit)
      else merged.set(hit.docKey, { ...prev, score: Math.max(prev.score, hit.score) })
    }
    hits = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  }

  if (token !== searchToken) return hits

  searchCache.set(key, { hits, registryRev: rev, at: now })
  snapshot = { query, hits, loading: false, revision: snapshot.revision + 1 }
  notify()
  return hits
}

export function clearKnowledgeSearchCache(): void {
  searchCache.clear()
}

export function resetKnowledgeSearchRuntime(): void {
  searchCache.clear()
  searchToken = 0
  snapshot = { query: '', hits: [], loading: false, revision: 0 }
  listeners.clear()
}
