import { getDocumentMeta, resolveDocKey } from './knowledgeRegistry'
import type { DocKey, ParsedWikiLink } from './types'

export type EmbedResolveResult = {
  docKey: DocKey
  absolutePath: string
  heading?: string
  blockId?: string
  depth: number
}

const embedStack = new Set<string>()
const MAX_EMBED_DEPTH = 8

function embedKey(docKey: DocKey, heading?: string, blockId?: string): string {
  return `${docKey}#${heading ?? ''}^${blockId ?? ''}`
}

export function resolveEmbedLink(
  link: ParsedWikiLink,
  depth = 0,
): EmbedResolveResult | null {
  if (link.kind !== 'embed') return null
  if (depth >= MAX_EMBED_DEPTH) return null

  const docKey = resolveDocKey(link.target.docKey)
  if (!docKey) return null

  const key = embedKey(docKey, link.target.heading, link.target.blockId)
  if (embedStack.has(key)) return null

  const meta = getDocumentMeta(docKey)
  if (!meta) {
    return {
      docKey,
      absolutePath: '',
      heading: link.target.heading,
      blockId: link.target.blockId,
      depth,
    }
  }

  embedStack.add(key)
  try {
    return {
      docKey,
      absolutePath: meta.absolutePath,
      heading: link.target.heading,
      blockId: link.target.blockId,
      depth,
    }
  } finally {
    embedStack.delete(key)
  }
}

export function canMountEmbed(docKey: DocKey, heading?: string, blockId?: string): boolean {
  return !embedStack.has(embedKey(docKey, heading, blockId))
}

export function resetEmbedRuntime(): void {
  embedStack.clear()
}
