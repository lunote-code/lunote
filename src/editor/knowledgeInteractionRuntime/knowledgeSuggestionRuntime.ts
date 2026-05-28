import {
  getDocumentMeta,
  getDocumentsByTag,
  getIncomingEdges,
  getOutgoingEdges,
  listDocumentMetas,
} from '../knowledgeRuntime'
import { scheduleInteractionTask } from './interactionScheduler'
import { rankSemanticHit } from './semanticRankRuntime'
import type { KnowledgeSuggestion } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

export function getRelatedNotesSync(contextDocKey: DocKey, limit = 8): KnowledgeSuggestion[] {
  const suggestions: KnowledgeSuggestion[] = []
  const seen = new Set<DocKey>([contextDocKey])

  const meta = getDocumentMeta(contextDocKey)
  for (const tag of meta?.outboundTags ?? []) {
    for (const docKey of getDocumentsByTag(tag)) {
      if (seen.has(docKey)) continue
      seen.add(docKey)
      const m = getDocumentMeta(docKey)
      suggestions.push({
        authority: 'suggestion',
        docKey,
        title: m?.title ?? docKey,
        reason: 'tag',
        score: 70,
      })
    }
  }

  for (const e of getOutgoingEdges(contextDocKey)) {
    const target = e.to.replace(/^page:/u, '')
    if (seen.has(target)) continue
    seen.add(target)
    const m = getDocumentMeta(target)
    suggestions.push({
      authority: 'suggestion',
      docKey: target,
      title: m?.title ?? target,
      reason: 'link',
      score: 65,
    })
  }

  for (const e of getIncomingEdges(contextDocKey)) {
    const src = e.sourceDocKey
    if (seen.has(src)) continue
    seen.add(src)
    const m = getDocumentMeta(src)
    suggestions.push({
      authority: 'suggestion',
      docKey: src,
      title: m?.title ?? src,
      reason: 'graph',
      score: 60,
    })
  }

  suggestions.sort((a, b) => b.score - a.score)
  return suggestions.slice(0, limit)
}

export function scheduleKnowledgeSuggestions(
  contextDocKey: DocKey,
  queryHint: string,
  onReady: (suggestions: KnowledgeSuggestion[]) => void,
): void {
  scheduleInteractionTask({
    key: `suggest:${contextDocKey}`,
    kind: 'suggestion',
    priority: 'idle',
    run: () => {
      const base = getRelatedNotesSync(contextDocKey, 12)
      const enriched = base.map((s) => {
        const meta = getDocumentMeta(s.docKey)
        const rank = rankSemanticHit({
          query: queryHint || meta?.title || s.docKey,
          docKey: s.docKey,
          title: s.title,
          snippet: s.title,
          tags: meta?.outboundTags ?? [],
          indexedAt: meta?.indexedAt,
          contextDocKey,
        })
        return { ...s, score: s.score + rank.total * 0.3, reason: s.reason }
      })
      for (const meta of listDocumentMetas()) {
        if (meta.docKey === contextDocKey) continue
        if (enriched.some((e) => e.docKey === meta.docKey)) continue
        const rank = rankSemanticHit({
          query: queryHint,
          docKey: meta.docKey,
          title: meta.title,
          snippet: meta.title,
          tags: meta.outboundTags,
          contextDocKey,
        })
        if (rank.total < 40) continue
        enriched.push({
          authority: 'suggestion',
          docKey: meta.docKey,
          title: meta.title,
          reason: 'semantic',
          score: rank.total,
        })
      }
      enriched.sort((a, b) => b.score - a.score)
      onReady(enriched.slice(0, 10))
    },
  })
}

export function resetKnowledgeSuggestionRuntime(): void {
  /* stateless */
}
