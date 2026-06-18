import { getBacklinksForDoc } from './backlinkEngine'
import { listDocumentMetas, resolveDocKey } from './knowledgeRegistry'
import { getDocumentsByTag } from './tagIndex'
import type { DocKey, SearchHit } from './types'

type SearchIndexEntry = {
  docKey: DocKey
  absolutePath: string
  title: string
  titleLower: string
  tags: string[]
  tagsLower: string[]
  bodySample: string
}

const searchIndex = new Map<DocKey, SearchIndexEntry>()
let searchQueue: Array<() => void> = []
let searchDraining = false

export function upsertSearchIndexEntry(
  docKey: DocKey,
  absolutePath: string,
  title: string,
  tags: string[],
  bodySample: string,
): void {
  searchIndex.set(docKey, {
    docKey,
    absolutePath,
    title,
    titleLower: title.toLowerCase(),
    tags,
    tagsLower: tags.map((t) => t.toLowerCase()),
    bodySample: bodySample.slice(0, 2000),
  })
}

export function removeSearchIndexEntry(docKey: DocKey): void {
  searchIndex.delete(docKey)
}

function fuzzyScore(text: string, query: string): number {
  if (!query) return 0
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 50
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length ? 30 : 0
}

function runSearchSync(query: string, limit: number): SearchHit[] {
  const hits: SearchHit[] = []
  for (const entry of searchIndex.values()) {
    const titleScore = fuzzyScore(entry.titleLower, query)
    const bodyScore = fuzzyScore(entry.bodySample, query) * 0.5
    const tagQuery = query.toLowerCase()
    const matchingTags = entry.tags.filter((_, index) => entry.tagsLower[index]?.includes(tagQuery))
    const tagScore = matchingTags.length > 0 ? 40 : 0
    const score = Math.max(titleScore, bodyScore, tagScore)
    if (score <= 0) continue
    const matchKind =
      score === tagScore && tagScore > titleScore && tagScore > bodyScore
        ? 'tag'
        : titleScore >= bodyScore
          ? 'title'
          : 'content'
    hits.push({
      docKey: entry.docKey,
      absolutePath: entry.absolutePath,
      title: entry.title,
      score,
      snippet:
        matchKind === 'tag'
          ? matchingTags.slice(0, 3).map((tag) => `#${tag}`).join(' ')
          : entry.bodySample.slice(0, 120),
      matchKind,
    })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}

export function searchKnowledgeAsync(
  query: string,
  options?: { limit?: number; tag?: string; backlinkOf?: DocKey },
): Promise<SearchHit[]> {
  const limit = options?.limit ?? 50
  return new Promise((resolve) => {
    searchQueue.push(() => {
      if (options?.tag) {
        const keys = getDocumentsByTag(options.tag)
        resolve(
          keys
            .map((k) => searchIndex.get(k))
            .filter(Boolean)
            .map((e) => ({
              docKey: e!.docKey,
              absolutePath: e!.absolutePath,
              title: e!.title,
              score: 60,
              matchKind: 'tag' as const,
            }))
            .slice(0, limit),
        )
        return
      }
      if (options?.backlinkOf) {
        const bl = getBacklinksForDoc(options.backlinkOf)
        resolve(
          bl.map((b) => ({
            docKey: b.sourceDocKey,
            absolutePath: b.sourceAbsolutePath,
            title: b.sourceTitle,
            score: 70,
            matchKind: 'backlink' as const,
          })),
        )
        return
      }
      resolve(runSearchSync(query, limit))
    })
    scheduleSearchDrain()
  })
}

function scheduleSearchDrain(): void {
  if (searchDraining) return
  searchDraining = true
  queueMicrotask(() => {
    searchDraining = false
    const batch = searchQueue
    searchQueue = []
    for (const fn of batch) fn()
  })
}

export function rebuildSearchIndexFromRegistry(): void {
  searchIndex.clear()
  for (const meta of listDocumentMetas()) {
    upsertSearchIndexEntry(
      meta.docKey,
      meta.absolutePath,
      meta.title,
      meta.outboundTags,
      meta.bodySample ?? '',
    )
  }
}

export function resolveSearchTarget(query: string): DocKey | null {
  return resolveDocKey(query)
}

export function resetSearchRuntime(): void {
  searchIndex.clear()
  searchQueue = []
  searchDraining = false
}
