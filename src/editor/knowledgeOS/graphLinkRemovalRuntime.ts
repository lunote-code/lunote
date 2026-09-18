import {
  linkTargetMatchesDoc,
  parseWikiLinksInText,
  canonicalizeWikiLinkText,
} from '../knowledgeRuntime'
import {
  hasUnresolvedPrefix,
  normalizeDocKeyForComparison,
} from '../knowledgeRuntime/docKeyNormalization'
import type { DocKey } from '../knowledgeRuntime/types'
import type { NoteGraphEdge } from './types'
import { getKnowledgeInteractionHost } from './ui/knowledgeInteractionHost'

export type GraphLinkRemovalResult = 'ok' | 'missing' | 'invalid' | 'failed'

function wikiLinkRemovalTargetMatches(entryDocKey: DocKey, targetDocKey: DocKey): boolean {
  const entryComparisonKey = normalizeDocKeyForComparison(entryDocKey)
  const targetComparisonKey = normalizeDocKeyForComparison(targetDocKey)
  if (entryComparisonKey && targetComparisonKey && entryComparisonKey === targetComparisonKey) {
    return true
  }
  if (hasUnresolvedPrefix(targetDocKey)) return false
  return linkTargetMatchesDoc(entryDocKey, targetDocKey)
}

export function parseGraphEdgeLinkSpan(edgeId: string): { start: number; end: number } | null {
  const match = /:(\d+):(\d+)$/.exec(edgeId)
  if (!match) return null
  const start = Number.parseInt(match[1] ?? '', 10)
  const end = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null
  return { start, end }
}

export function removeWikiLinkFromMarkdownBody(
  body: string,
  targetDocKey: DocKey,
  options?: { heading?: string; kind?: 'link' | 'embed'; start?: number; end?: number },
): string {
  const poolKind = options?.kind ?? 'link'
  const { links, embeds } = parseWikiLinksInText(body)
  const pool = poolKind === 'embed' ? embeds : links
  const headingNeedle = options?.heading ? canonicalizeWikiLinkText(options.heading) : null

  const match =
    options?.start != null && options?.end != null
      ? pool.find((entry) => entry.start === options.start && entry.end === options.end)
      : pool.find((entry) => {
        if (!wikiLinkRemovalTargetMatches(entry.target.docKey, targetDocKey)) {
          return false
        }
        if (headingNeedle) {
          const entryHeading = entry.target.heading
            ? canonicalizeWikiLinkText(entry.target.heading)
            : null
          return entryHeading === headingNeedle
        }
        return true
      })
  if (!match) return body

  let next = `${body.slice(0, match.start)}${body.slice(match.end)}`
  next = next.replace(/\n{3,}/gu, '\n\n')
  return next
}

export function resolveGraphEdgeWikiRemoval(edge: NoteGraphEdge): {
  sourceDocKey: DocKey
  targetDocKey: DocKey
  heading?: string
  kind: 'link' | 'embed'
  start?: number
  end?: number
} | null {
  if (!edge.from.startsWith('page:')) return null
  const sourceDocKey = edge.from.slice(5)
  if (!sourceDocKey) return null
  const span = parseGraphEdgeLinkSpan(edge.id)

  if (edge.to.startsWith('heading:')) {
    const parts = edge.to.split(':')
    const targetDocKey = parts[1] ?? ''
    const headingSlug = parts.slice(2).join(':')
    if (!targetDocKey || !headingSlug) return null
    return {
      sourceDocKey,
      targetDocKey,
      heading: headingSlug,
      kind: edge.kind,
      ...(span ?? {}),
    }
  }

  if (edge.to.startsWith('page:')) {
    const targetDocKey = edge.to.slice(5)
    if (!targetDocKey) return null
    return { sourceDocKey, targetDocKey, kind: edge.kind, ...(span ?? {}) }
  }

  if (edge.to.startsWith('unresolved:')) {
    return {
      sourceDocKey,
      targetDocKey: edge.to,
      kind: edge.kind,
      ...(span ?? {}),
    }
  }

  return null
}

export async function removeGraphWikiLink(edge: NoteGraphEdge): Promise<GraphLinkRemovalResult> {
  const removal = resolveGraphEdgeWikiRemoval(edge)
  if (!removal) return 'invalid'

  const host = getKnowledgeInteractionHost()
  if (!host?.removeWikiLinkBetweenNotes) return 'failed'

  const ok = await host.removeWikiLinkBetweenNotes({
    sourceDocKey: removal.sourceDocKey,
    targetDocKey: removal.targetDocKey,
    heading: removal.heading,
    kind: removal.kind,
    start: removal.start,
    end: removal.end,
  })
  return ok ? 'ok' : 'missing'
}
