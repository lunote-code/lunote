import { runKnowledgeSearch } from '../../knowledgeOS/knowledgeSearchRuntime'
import type { AiWorkspaceSnippet } from '../aiChatTypes'

export const AI_RAG_MAX_SNIPPETS = 5
export const AI_RAG_SNIPPET_MAX_CHARS = 500
export const AI_RAG_TOTAL_MAX_CHARS = 2000

export type BuildAiRagContextInput = {
  query: string
  excludeDocKey?: string | null
  limit?: number
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  if (maxChars <= 1) return '…'
  return `${text.slice(0, maxChars - 1).trimEnd()}…`
}

function stripSnippetMarks(text: string): string {
  return text.replace(/<\/?mark>/giu, '').trim()
}

export function formatAiRagSnippets(
  hits: ReadonlyArray<{ docKey: string; title: string; snippet?: string }>,
  options?: { excludeDocKey?: string | null; limit?: number },
): AiWorkspaceSnippet[] {
  const limit = options?.limit ?? AI_RAG_MAX_SNIPPETS
  const excludeDocKey = options?.excludeDocKey ?? null
  const snippets: AiWorkspaceSnippet[] = []
  let totalChars = 0

  for (const hit of hits) {
    if (snippets.length >= limit) break
    if (excludeDocKey && hit.docKey === excludeDocKey) continue
    const rawSnippet = stripSnippetMarks(hit.snippet ?? '')
    if (!rawSnippet) continue

    const remaining = AI_RAG_TOTAL_MAX_CHARS - totalChars
    if (remaining <= 0) break

    const perSnippetBudget = Math.min(AI_RAG_SNIPPET_MAX_CHARS, remaining)
    const snippet = truncate(rawSnippet, perSnippetBudget)
    if (!snippet) continue

    snippets.push({
      docKey: hit.docKey,
      title: hit.title,
      snippet,
    })
    totalChars += snippet.length
  }

  return snippets
}

export async function buildAiRagContext(input: BuildAiRagContextInput): Promise<AiWorkspaceSnippet[]> {
  const query = input.query.trim()
  if (!query) return []

  const hits = await runKnowledgeSearch(query, { limit: input.limit ?? AI_RAG_MAX_SNIPPETS * 2 })
  return formatAiRagSnippets(hits, {
    excludeDocKey: input.excludeDocKey,
    limit: input.limit ?? AI_RAG_MAX_SNIPPETS,
  })
}
