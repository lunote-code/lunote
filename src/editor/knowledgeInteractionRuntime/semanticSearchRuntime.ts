import {
  getDocumentMeta,
  listDocumentMetas,
  searchKnowledgeAsync,
} from '../knowledgeRuntime'
import { emitInteractionEvent } from './interactionEvents'
import { scheduleInteractionTask } from './interactionScheduler'
import { rankSemanticHit, compareSemanticRank } from './semanticRankRuntime'
import type { SemanticSearchResult } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

function extractMatchedHeading(content: string, query: string): string | undefined {
  const q = query.toLowerCase()
  for (const line of content.split('\n')) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line)
    if (m && m[2]!.toLowerCase().includes(q)) return m[2]!.trim()
  }
  return undefined
}

function extractMatchedBlock(content: string, query: string): string | undefined {
  const re = new RegExp(`\\^([a-zA-Z0-9_-]*${escapeRegex(query)}[a-zA-Z0-9_-]*)`, 'i')
  const m = re.exec(content)
  return m?.[1]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type SemanticSearchOptions = {
  limit?: number
  contextDocKey?: DocKey
  contentResolver?: (docKey: DocKey) => Promise<string | null>
}

export function searchSemanticAsync(
  query: string,
  options?: SemanticSearchOptions,
): Promise<SemanticSearchResult[]> {
  const limit = options?.limit ?? 30
  const contextDocKey = options?.contextDocKey

  return new Promise((resolve) => {
    scheduleInteractionTask({
      key: `search:${query}:${contextDocKey ?? ''}`,
      kind: 'semantic-search',
      priority: 'visible',
      run: async () => {
        const baseHits = await searchKnowledgeAsync(query, { limit: limit * 2 })
        const results: SemanticSearchResult[] = []

        for (const hit of baseHits) {
          const meta = getDocumentMeta(hit.docKey)
          let content = ''
          if (options?.contentResolver) {
            content = (await options.contentResolver(hit.docKey)) ?? ''
          }
          const rank = rankSemanticHit({
            query,
            docKey: hit.docKey,
            title: hit.title,
            snippet: hit.snippet ?? content.slice(0, 200),
            tags: meta?.outboundTags ?? [],
            indexedAt: meta?.indexedAt,
            contextDocKey,
          })
          results.push({
            authority: 'suggestion',
            docKey: hit.docKey,
            absolutePath: hit.absolutePath,
            title: hit.title,
            score: rank.total,
            snippet: hit.snippet ?? content.slice(0, 160),
            matchedHeading: content ? extractMatchedHeading(content, query) : undefined,
            matchedBlock: content ? extractMatchedBlock(content, query) : undefined,
            relevance: {
              fuzzy: rank.fuzzy,
              alias: rank.alias,
              backlink: rank.backlink,
              tag: rank.tag,
              recency: rank.recency,
              graphDistance: rank.graphDistance,
            },
          })
        }

        if (!results.length && query.trim()) {
          for (const meta of listDocumentMetas()) {
            const rank = rankSemanticHit({
              query,
              docKey: meta.docKey,
              title: meta.title,
              snippet: meta.title,
              tags: meta.outboundTags,
              indexedAt: meta.indexedAt,
              contextDocKey,
            })
            if (rank.total <= 0) continue
            results.push({
              authority: 'suggestion',
              docKey: meta.docKey,
              absolutePath: meta.absolutePath,
              title: meta.title,
              score: rank.total,
              snippet: meta.title,
              relevance: {
                fuzzy: rank.fuzzy,
                alias: rank.alias,
                backlink: rank.backlink,
                tag: rank.tag,
                recency: rank.recency,
                graphDistance: rank.graphDistance,
              },
            })
          }
        }

        results.sort((a, b) => compareSemanticRank(
          { total: a.score },
          { total: b.score },
        ))
        const sliced = results.slice(0, limit)
        emitInteractionEvent('search-ranked', { query, count: sliced.length })
        resolve(sliced)
      },
    })
  })
}

export function resetSemanticSearchRuntime(): void {
  /* stateless */
}
