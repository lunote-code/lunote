import { getDocumentMeta, resolveDocKey } from '../../knowledgeRuntime'
import { parseWikiLinksInText } from '../../knowledgeRuntime/wikiLinkParser'
import type { AiWorkspaceSnippet } from '../aiChatTypes'

export const AI_MENTION_MAX_NOTES = 5
export const AI_MENTION_EXCERPT_MAX_CHARS = 1500

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}…`
}

export function buildAiMentionContext(text: string, excludeDocKey?: string | null): AiWorkspaceSnippet[] {
  const { links } = parseWikiLinksInText(text)
  if (links.length === 0) return []

  const snippets: AiWorkspaceSnippet[] = []
  const seen = new Set<string>()

  for (const link of links) {
    if (snippets.length >= AI_MENTION_MAX_NOTES) break
    const query = link.target.alias?.trim() || link.target.docKey.trim()
    if (!query) continue
    const docKey = resolveDocKey(query)
    if (!docKey || seen.has(docKey)) continue
    if (excludeDocKey && docKey === excludeDocKey) continue
    seen.add(docKey)

    const meta = getDocumentMeta(docKey)
    if (!meta) continue
    const excerptSource = meta.bodySample?.trim() ?? ''
    if (!excerptSource) continue

    snippets.push({
      docKey,
      title: meta.title.trim() || docKey.split('/').pop() || docKey,
      snippet: truncate(excerptSource, AI_MENTION_EXCERPT_MAX_CHARS),
    })
  }

  return snippets
}
