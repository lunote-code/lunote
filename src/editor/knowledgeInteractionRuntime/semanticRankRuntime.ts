import type { DocKey } from '../knowledgeRuntime/types'
import { getDocumentMeta } from '../knowledgeRuntime'
import { getIncomingEdges, getOutgoingEdges } from '../knowledgeRuntime'
import { rankCache } from './contextCache'
import type { SemanticSearchResult } from './types'

export type RankInputs = {
  query: string
  docKey: DocKey
  title: string
  snippet: string
  tags: string[]
  indexedAt?: number
  contextDocKey?: DocKey
}

function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 85
  if (t.includes(q)) return 55
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length ? 35 : 0
}

function aliasScore(docKey: DocKey, query: string): number {
  const meta = getDocumentMeta(docKey)
  if (!meta) return 0
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (docKey.toLowerCase() === q) return 85
  const base = docKey.split('/').pop()?.toLowerCase() ?? ''
  if (base && base === q) return 80
  if (meta.title.toLowerCase() === q) return 80
  for (const a of meta.frontmatter.aliases ?? []) {
    if (String(a).toLowerCase() === q) return 75
  }
  return 0
}

function backlinkWeight(docKey: DocKey, contextDocKey?: DocKey): number {
  if (!contextDocKey) return 0
  const incoming = getIncomingEdges(contextDocKey)
  if (incoming.some((e) => e.sourceDocKey === docKey)) return 40
  const outgoing = getOutgoingEdges(contextDocKey)
  if (outgoing.some((e) => e.to.endsWith(docKey))) return 25
  return 0
}

function tagProximity(tags: string[], contextDocKey?: DocKey): number {
  if (!contextDocKey) return 0
  const ctx = getDocumentMeta(contextDocKey)
  if (!ctx?.outboundTags.length) return 0
  const ctxSet = new Set(ctx.outboundTags.map((t) => t.toLowerCase()))
  let shared = 0
  for (const t of tags) {
    if (ctxSet.has(t.toLowerCase())) shared++
  }
  return Math.min(30, shared * 10)
}

function recencyBoost(indexedAt?: number): number {
  if (!indexedAt) return 0
  const age = performance.now() - indexedAt
  if (age < 60_000) return 15
  if (age < 3600_000) return 8
  return 0
}

function graphDistanceScore(docKey: DocKey, contextDocKey?: DocKey): number {
  if (!contextDocKey || docKey === contextDocKey) return 0
  const out = getOutgoingEdges(contextDocKey)
  if (out.some((e) => e.to.includes(docKey))) return 20
  const inc = getIncomingEdges(contextDocKey)
  if (inc.some((e) => e.sourceDocKey === docKey)) return 18
  return 0
}

export function rankSemanticHit(inputs: RankInputs): SemanticSearchResult['relevance'] & { total: number } {
  const cacheKey = `rank:${inputs.contextDocKey ?? ''}:${inputs.docKey}:${inputs.query}`
  const cached = rankCache.get(cacheKey) as
    | (SemanticSearchResult['relevance'] & { total: number })
    | undefined
  if (cached) return cached

  const fuzzy = fuzzyScore(`${inputs.title} ${inputs.snippet}`, inputs.query)
  const alias = aliasScore(inputs.docKey, inputs.query)
  const backlink = backlinkWeight(inputs.docKey, inputs.contextDocKey)
  const tag = tagProximity(inputs.tags, inputs.contextDocKey)
  const recency = recencyBoost(inputs.indexedAt)
  const graphDistance = graphDistanceScore(inputs.docKey, inputs.contextDocKey)
  const total = fuzzy + alias + backlink + tag + recency + graphDistance
  const result = { fuzzy, alias, backlink, tag, recency, graphDistance, total }
  rankCache.set(cacheKey, result, inputs.query)
  return result
}

export function compareSemanticRank(a: { total: number }, b: { total: number }): number {
  return b.total - a.total
}
