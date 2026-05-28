import { getDocumentMeta, listDocumentMetas } from '../knowledgeRuntime'
import { mentionCandidateCache } from './contextCache'
import { scheduleInteractionTask } from './interactionScheduler'
import type { UnlinkedMentionCandidate } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

/** term populated by incrementalIndexer → docKey inversion (lightweight)*/
const termRegistry = new Map<string, Set<DocKey>>()

export function registerTermsFromDocument(docKey: DocKey, title: string, tags: string[]): void {
  const terms = tokenize(title)
  for (const t of tags) terms.push(...tokenize(t))
  for (const term of terms) {
    if (!termRegistry.has(term)) termRegistry.set(term, new Set())
    termRegistry.get(term)!.add(docKey)
  }
}

export function unregisterDocumentTerms(docKey: DocKey): void {
  for (const set of termRegistry.values()) {
    set.delete(docKey)
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/iu)
    .filter((t) => t.length >= 3)
}

/**
 * Incremental: Only scan the indexed phrases of the current document, not the full text of the vault.
 */
export function findUnlinkedMentionsIncremental(
  sourceDocKey: DocKey,
  content: string,
  contentHash: string,
): UnlinkedMentionCandidate[] {
  const cacheKey = `mention:${sourceDocKey}`
  const cached = mentionCandidateCache.get(cacheKey, contentHash) as
    | UnlinkedMentionCandidate[]
    | undefined
  if (cached) return cached

  const candidates: UnlinkedMentionCandidate[] = []
  const metas = listDocumentMetas()
  const sourceTitleLower = getDocumentMeta(sourceDocKey)?.title.trim().toLowerCase() ?? null

  for (const meta of metas) {
    if (meta.docKey === sourceDocKey) continue
    if (content.includes(`[[${meta.title}]]`) || content.includes(`[[${meta.docKey}]]`)) continue

    const titleLower = meta.title.toLowerCase()
    const idx = content.toLowerCase().indexOf(titleLower)
    if (idx < 0) continue
    if (sourceTitleLower && meta.title.trim().toLowerCase() === sourceTitleLower) continue

    candidates.push({
      authority: 'suggestion',
      phrase: content.slice(idx, idx + meta.title.length),
      suggestedDocKey: meta.docKey,
      suggestedTitle: meta.title,
      confidence: 0.85,
      start: idx,
      end: idx + meta.title.length,
    })
  }

  for (const [term, docKeys] of termRegistry) {
    if (term.length < 4) continue
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      for (const docKey of docKeys) {
        if (docKey === sourceDocKey) continue
        const meta = metas.find((x) => x.docKey === docKey)
        if (!meta) continue
        if (content.slice(m.index).startsWith('[[')) continue
        candidates.push({
          authority: 'suggestion',
          phrase: m[0]!,
          suggestedDocKey: docKey,
          suggestedTitle: meta.title,
          confidence: 0.6,
          start: m.index,
          end: m.index + m[0]!.length,
        })
      }
    }
  }

  const deduped = dedupeCandidates(candidates)
  mentionCandidateCache.set(cacheKey, deduped, contentHash)
  return deduped
}

function dedupeCandidates(list: UnlinkedMentionCandidate[]): UnlinkedMentionCandidate[] {
  const seen = new Set<string>()
  const out: UnlinkedMentionCandidate[] = []
  for (const c of list.sort((a, b) => b.confidence - a.confidence)) {
    const key = `${c.start}:${c.suggestedDocKey}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out.slice(0, 12)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function scheduleMentionScan(
  sourceDocKey: DocKey,
  content: string,
  contentHash: string,
  onReady: (candidates: UnlinkedMentionCandidate[]) => void,
): void {
  scheduleInteractionTask({
    key: `mention:${sourceDocKey}`,
    kind: 'mention-scan',
    priority: 'idle',
    run: () => {
      const candidates = findUnlinkedMentionsIncremental(sourceDocKey, content, contentHash)
      onReady(candidates)
    },
  })
}

export function resetUnlinkedMentionRuntime(): void {
  termRegistry.clear()
}
