import { getAppSettingsSnapshot } from '../../settings/appSettingsStore'
import { resolveAiSettings, isAiConfiguredFromSettings, resolveAiSystemPrompt } from '../../settings-runtime/aiSettings'
import { buildAiGraphContext } from '../ai/context/buildAiGraphContext'
import { streamAiChat } from '../ai/aiChatService'
import { createAiChatMessageId, type AiChatMessage } from '../ai/aiChatTypes'
import {
  canonicalizeWikiLinkText,
  getDocumentMeta,
  listDocumentMetas,
  resolveDocKey,
} from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import { hasOutgoingWikiLink } from './graphLinkCreationRuntime'
import type { GraphLinkSuggestionItem } from './graphGapDetection'

const GRAPH_AI_LINK_SUGGESTION_PROMPT = [
  'Action output format: Output a single JSON object only—no markdown fences, preamble, or commentary.',
  'Schema: { "links": [ { "from": "exact note key or title", "to": "exact note key or title", "reason": "short explanation" } ] }',
  'Propose up to 6 high-value wiki links that are missing between the supplied notes.',
  'Only use note titles/keys that appear in the workspace context. Do not invent notes.',
  'Skip links that already exist. Prefer bidirectional knowledge gaps, shared themes, and orphan integration.',
].join('\n')

type RawAiLinkRow = {
  from?: unknown
  to?: unknown
  reason?: unknown
}

function parseAiLinkSuggestionPayload(text: string): RawAiLinkRow[] {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (Array.isArray(parsed)) return parsed as RawAiLinkRow[]
      if (parsed && typeof parsed === 'object') {
        const record = parsed as { links?: unknown; suggestions?: unknown }
        if (Array.isArray(record.links)) return record.links as RawAiLinkRow[]
        if (Array.isArray(record.suggestions)) return record.suggestions as RawAiLinkRow[]
      }
    } catch {
      // try next candidate
    }
    const arrayMatch = candidate.match(/\{[\s\S]*\}/)
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]) as { links?: unknown; suggestions?: unknown }
        if (Array.isArray(parsed.links)) return parsed.links as RawAiLinkRow[]
        if (Array.isArray(parsed.suggestions)) return parsed.suggestions as RawAiLinkRow[]
      } catch {
        // ignore
      }
    }
  }

  return []
}

export function resolveGraphAiNoteRef(value: unknown): { docKey: DocKey; title: string } | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/^["'`]+|["'`]+$/g, '').trim()
  if (!trimmed) return null
  const resolved = resolveDocKey(trimmed)
  if (resolved) {
    const meta = getDocumentMeta(resolved)
    if (meta) return { docKey: resolved, title: meta.title.trim() || resolved }
  }
  const canonical = canonicalizeWikiLinkText(trimmed)
  const lower = trimmed.toLowerCase()
  for (const meta of listDocumentMetas()) {
    const title = meta.title.trim()
    if (!title) continue
    if (canonicalizeWikiLinkText(title) === canonical || title.toLowerCase() === lower) {
      return { docKey: meta.docKey, title: title || meta.docKey }
    }
  }
  return null
}

export type GraphAiLinkSuggestionResult =
  | { ok: true; suggestions: GraphLinkSuggestionItem[] }
  | { ok: false; code: 'not_configured' | 'empty_response' | 'aborted' | 'network' | 'unknown' }

export async function fetchGraphAiLinkSuggestions(args: {
  centerDocKey: DocKey
  gapSummary: string
  signal?: AbortSignal
}): Promise<GraphAiLinkSuggestionResult> {
  const settings = resolveAiSettings(getAppSettingsSnapshot())
  if (!isAiConfiguredFromSettings(settings)) {
    return { ok: false, code: 'not_configured' }
  }

  const centerMeta = getDocumentMeta(args.centerDocKey)
  const centerTitle = centerMeta?.title?.trim() || args.centerDocKey
  const centerExcerpt = centerMeta?.bodySample?.trim().slice(0, 600) ?? ''
  const neighbors = buildAiGraphContext(args.centerDocKey, { twoHop: true })

  const userMessage = [
    `Analyze missing wiki links for "${centerTitle}" (${args.centerDocKey}).`,
    centerExcerpt ? `Current note excerpt:\n${centerExcerpt}` : '',
    args.gapSummary ? `Heuristic gaps:\n${args.gapSummary}` : '',
    neighbors.length
      ? `Linked neighbors:\n${neighbors.map((n) => `- ${n.title} (${n.docKey})`).join('\n')}`
      : '',
    'Return JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const aiMessage: AiChatMessage = {
    id: createAiChatMessageId(),
    role: 'user',
    content: userMessage,
    createdAt: Date.now(),
  }

  let assistantText = ''
  try {
    for await (const event of streamAiChat({
      settings,
      messages: [aiMessage],
      context: {
        docKey: args.centerDocKey,
        title: centerTitle,
        excerpt: centerExcerpt || null,
        selection: null,
        taskMode: 'knowledge',
        systemHint: GRAPH_AI_LINK_SUGGESTION_PROMPT,
        customSystemPrompt: resolveAiSystemPrompt(getAppSettingsSnapshot()) || null,
        graphNeighbors: neighbors,
        graphNeighborMaxHops: 2,
      },
      signal: args.signal,
    })) {
      if (event.type === 'delta') {
        assistantText += event.text
        continue
      }
      if (event.type === 'error') {
        if (event.code === 'aborted') return { ok: false, code: 'aborted' }
        if (event.code === 'network') return { ok: false, code: 'network' }
        return { ok: false, code: 'unknown' }
      }
      if (event.type === 'done') break
    }
  } catch {
    if (args.signal?.aborted) return { ok: false, code: 'aborted' }
    return { ok: false, code: 'unknown' }
  }

  const rows = parseAiLinkSuggestionPayload(assistantText)
  if (rows.length === 0) return { ok: false, code: 'empty_response' }

  const suggestions: GraphLinkSuggestionItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const from = resolveGraphAiNoteRef(row.from)
    const to = resolveGraphAiNoteRef(row.to)
    if (!from || !to || from.docKey === to.docKey) continue
    if (hasOutgoingWikiLink(from.docKey, to.docKey)) continue
    const pairKey = `${from.docKey}\0${to.docKey}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    suggestions.push({
      id: `ai:${pairKey}`,
      sourceDocKey: from.docKey,
      targetDocKey: to.docKey,
      sourceTitle: from.title,
      targetTitle: to.title,
      reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'ai',
      origin: 'ai',
      confidence: 0.75,
    })
    if (suggestions.length >= 6) break
  }

  if (suggestions.length === 0) return { ok: false, code: 'empty_response' }
  return { ok: true, suggestions }
}
