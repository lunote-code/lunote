import { useMemo } from 'react'
import { listDocumentMetas } from '../../knowledgeRuntime'
import { isWorkspaceTemplateDocKey } from '../../../templates/templatePathMatch'
import { wikiLinkInsertTarget } from '../../lunaWikiLinkSuggest'

export type AiMentionCandidate = {
  docKey: string
  title: string
  hint: string
  insertText: string
  score: number
}

function scoreCandidate(query: string, title: string, docKey: string): number {
  const q = query.trim().toLowerCase()
  const titleLower = title.toLowerCase()
  const keyLower = docKey.toLowerCase()
  const base = (docKey.split('/').pop() ?? '').toLowerCase()
  if (!q) return 1
  if (titleLower === q || keyLower === q || base === q) return 100
  if (titleLower.startsWith(q)) return 80
  if (keyLower.startsWith(q) || base.startsWith(q)) return 70
  if (titleLower.includes(q) || keyLower.includes(q) || base.includes(q)) return 50
  return 0
}

export function matchAiMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret)
  const hit = /(?:^|\s)@([^\s@]*)$/u.exec(before)
  if (!hit) return null
  const query = hit[1] ?? ''
  const atIndex = before.length - query.length - 1
  return { query, start: atIndex }
}

export function searchAiMentionCandidates(
  query: string,
  options?: { excludeDocKey?: string | null; limit?: number },
): AiMentionCandidate[] {
  const limit = options?.limit ?? 8
  const items: AiMentionCandidate[] = []

  for (const meta of listDocumentMetas()) {
    if (options?.excludeDocKey && meta.docKey === options.excludeDocKey) continue
    if (isWorkspaceTemplateDocKey(meta.docKey, [])) continue
    const score = scoreCandidate(query, meta.title, meta.docKey)
    if (score <= 0) continue
    const insertTarget = wikiLinkInsertTarget(meta.title, meta.docKey)
    items.push({
      docKey: meta.docKey,
      title: meta.title,
      hint: meta.docKey,
      insertText: `[[${insertTarget}]]`,
      score,
    })
  }

  return items
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function applyAiMentionSelection(
  text: string,
  start: number,
  caret: number,
  insertText: string,
): { nextText: string; nextCaret: number } {
  const before = text.slice(0, start)
  const after = text.slice(caret)
  const needsSpaceBefore = before.length > 0 && !/\s$/u.test(before)
  const prefix = needsSpaceBefore ? `${before} ` : before
  const nextText = `${prefix}${insertText}${after}`
  const nextCaret = prefix.length + insertText.length
  return { nextText, nextCaret }
}

export function useAiMentionState(text: string, caret: number, excludeDocKey?: string | null) {
  return useMemo(() => {
    const match = matchAiMentionQuery(text, caret)
    if (!match) {
      return { active: false as const, query: '', start: 0, candidates: [] as AiMentionCandidate[] }
    }
    return {
      active: true as const,
      query: match.query,
      start: match.start,
      candidates: searchAiMentionCandidates(match.query, { excludeDocKey }),
    }
  }, [caret, excludeDocKey, text])
}
