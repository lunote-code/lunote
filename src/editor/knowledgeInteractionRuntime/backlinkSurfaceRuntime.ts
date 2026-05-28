import { getBacklinksForDoc, getDocumentMeta } from '../knowledgeRuntime'
import { hashContent } from '../knowledgeRuntime'
import { snippetCache } from './contextCache'
import { emitInteractionEvent } from './interactionEvents'
import { scheduleInteractionTask } from './interactionScheduler'
import { rankSemanticHit } from './semanticRankRuntime'
import type { BacklinkSurfaceGroup, BacklinkSurfaceItem } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

export type ContentResolver = (docKey: DocKey) => Promise<string | null>

let contentResolver: ContentResolver | null = null

export function setBacklinkContentResolver(resolver: ContentResolver | null): void {
  contentResolver = resolver
}

function extractSnippetAroundLink(
  content: string,
  linkStart: number,
  radius = 80,
): { snippet: string; paragraphPreview: string } {
  const start = Math.max(0, linkStart - radius)
  const end = Math.min(content.length, linkStart + radius)
  const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim()

  const paraStart = content.lastIndexOf('\n\n', linkStart)
  const paraEnd = content.indexOf('\n\n', linkStart)
  const paragraphPreview = content
    .slice(paraStart < 0 ? 0 : paraStart + 2, paraEnd === -1 ? undefined : paraEnd)
    .slice(0, 400)
    .trim()

  return { snippet, paragraphPreview }
}

async function buildBacklinkItem(
  targetDocKey: DocKey,
  entry: ReturnType<typeof getBacklinksForDoc>[number],
  linkIndex: number,
): Promise<BacklinkSurfaceItem | null> {
  const link = entry.links[linkIndex]
  if (!link) return null

  let content = ''
  if (contentResolver) {
    content = (await contentResolver(entry.sourceDocKey)) ?? ''
  }
  const meta = getDocumentMeta(entry.sourceDocKey)
  const contentHash = hashContent(content || entry.sourceTitle)
  const cacheKey = `bl:${entry.sourceDocKey}:${link.start}`
  let snippets = snippetCache.get(cacheKey, contentHash) as
    | { snippet: string; paragraphPreview: string }
    | undefined
  if (!snippets) {
    snippets = content
      ? extractSnippetAroundLink(content, link.start)
      : { snippet: link.raw, paragraphPreview: link.raw }
    snippetCache.set(cacheKey, snippets, contentHash)
  }

  const rank = rankSemanticHit({
    query: targetDocKey,
    docKey: entry.sourceDocKey,
    title: entry.sourceTitle,
    snippet: snippets.snippet,
    tags: meta?.outboundTags ?? [],
    indexedAt: meta?.indexedAt,
    contextDocKey: targetDocKey,
  })

  return {
    sourceDocKey: entry.sourceDocKey,
    sourceTitle: entry.sourceTitle,
    sourceAbsolutePath: entry.sourceAbsolutePath,
    links: [link],
    snippet: snippets.snippet,
    paragraphPreview: snippets.paragraphPreview,
    mentionOffset: link.start,
    score: rank.total,
    group: link.kind === 'embed' ? 'embed' : 'direct',
  }
}

export function getBacklinkSurfaceSync(targetDocKey: DocKey): BacklinkSurfaceGroup[] {
  const entries = getBacklinksForDoc(targetDocKey)
  const items: BacklinkSurfaceItem[] = entries.flatMap((entry) =>
    entry.links.map((link, i) => ({
      sourceDocKey: entry.sourceDocKey,
      sourceTitle: entry.sourceTitle,
      sourceAbsolutePath: entry.sourceAbsolutePath,
      links: [link],
      snippet: link.raw,
      paragraphPreview: link.raw,
      mentionOffset: link.start,
      score: 50 - i,
      group: (link.kind === 'embed' ? 'embed' : 'direct') as BacklinkSurfaceItem['group'],
    })),
  )
  items.sort((a, b) => b.score - a.score)
  return groupBacklinkItems(items)
}

export function loadBacklinkSurfaceAsync(
  targetDocKey: DocKey,
  onReady: (groups: BacklinkSurfaceGroup[]) => void,
): void {
  scheduleInteractionTask({
    key: `backlink:${targetDocKey}`,
    kind: 'backlink-group',
    priority: 'background',
    run: async () => {
      const entries = getBacklinksForDoc(targetDocKey)
      const items: BacklinkSurfaceItem[] = []
      for (const entry of entries) {
        for (let i = 0; i < entry.links.length; i++) {
          const item = await buildBacklinkItem(targetDocKey, entry, i)
          if (item) items.push(item)
        }
      }
      items.sort((a, b) => b.score - a.score)
      const groups = groupBacklinkItems(items)
      onReady(groups)
      emitInteractionEvent('context-updated', {
        docKey: targetDocKey,
        revision: items.length,
      })
    },
  })
}

function groupBacklinkItems(items: BacklinkSurfaceItem[]): BacklinkSurfaceGroup[] {
  const direct = items.filter((i) => i.group === 'direct')
  const embed = items.filter((i) => i.group === 'embed')
  const mention = items.filter((i) => i.group === 'mention')
  const groups: BacklinkSurfaceGroup[] = []
  if (direct.length) groups.push({ id: 'direct', label: 'Links', items: direct })
  if (embed.length) groups.push({ id: 'embed', label: 'Embeds', items: embed })
  if (mention.length) groups.push({ id: 'mention', label: 'Mentions', items: mention })
  return groups
}

export function resetBacklinkSurfaceRuntime(): void {
  contentResolver = null
}
