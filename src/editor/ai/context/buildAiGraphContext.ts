import {
  getBacklinksForDoc,
  getDocumentMeta,
  getOutgoingLinkRefs,
} from '../../knowledgeRuntime'
import type { DocKey } from '../../knowledgeRuntime/types'
import type { AiGraphNeighbor } from '../aiChatTypes'

export type { AiGraphNeighbor } from '../aiChatTypes'

export const AI_GRAPH_MAX_NEIGHBORS = 8
export const AI_GRAPH_NEIGHBOR_EXCERPT_MAX_CHARS = 500
export const AI_GRAPH_TOTAL_MAX_CHARS = 4000

function truncateExcerpt(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxChars) return trimmed
  if (maxChars <= 1) return '…'
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`
}

function estimateNeighborLineChars(neighbor: AiGraphNeighbor): number {
  return (
    neighbor.title.length +
    neighbor.path.length +
    (neighbor.excerpt?.length ?? 0) +
    12
  )
}

export function formatAiGraphNeighborList(
  neighbors: readonly AiGraphNeighbor[],
  options?: { maxCount?: number; maxChars?: number },
): AiGraphNeighbor[] {
  const maxCount = options?.maxCount ?? AI_GRAPH_MAX_NEIGHBORS
  const maxChars = options?.maxChars ?? AI_GRAPH_TOTAL_MAX_CHARS
  const result: AiGraphNeighbor[] = []
  let totalChars = 0

  for (const neighbor of neighbors) {
    if (result.length >= maxCount) break
    const lineChars = estimateNeighborLineChars(neighbor)
    if (totalChars + lineChars > maxChars && result.length > 0) break
    result.push(neighbor)
    totalChars += lineChars
  }

  return result
}

export type AiGraphContextOptions = {
  twoHop?: boolean
}

function collectLinkedDocKeys(sourceDocKey: DocKey): DocKey[] {
  const keys: DocKey[] = []
  const seen = new Set<string>()
  const addKey = (key: DocKey) => {
    if (seen.has(key)) return
    seen.add(key)
    keys.push(key)
  }
  for (const ref of getOutgoingLinkRefs(sourceDocKey)) {
    addKey(ref.targetDocKey)
  }
  for (const backlink of getBacklinksForDoc(sourceDocKey)) {
    addKey(backlink.sourceDocKey)
  }
  return keys
}

function collectRawGraphNeighbors(docKey: DocKey, maxHops: 1 | 2 = 1): AiGraphNeighbor[] {
  const seen = new Set<string>()
  const neighbors: AiGraphNeighbor[] = []

  const addNeighbor = (key: DocKey, centerDocKey: DocKey) => {
    if (key === centerDocKey || seen.has(key)) return
    seen.add(key)
    const meta = getDocumentMeta(key)
    if (!meta) return
    const excerpt = truncateExcerpt(
      meta.bodySample ?? '',
      AI_GRAPH_NEIGHBOR_EXCERPT_MAX_CHARS,
    )
    neighbors.push({
      docKey: key,
      title: meta.title.trim() || meta.absolutePath.split(/[/\\]/).pop() || key,
      path: meta.absolutePath,
      ...(excerpt ? { excerpt } : {}),
    })
  }

  for (const key of collectLinkedDocKeys(docKey)) {
    addNeighbor(key, docKey)
  }

  if (maxHops >= 2) {
    const hopOneKeys = neighbors.map((neighbor) => neighbor.docKey)
    for (const hopKey of hopOneKeys) {
      for (const linkedKey of collectLinkedDocKeys(hopKey)) {
        addNeighbor(linkedKey, docKey)
      }
    }
  }

  return neighbors
}

export function buildAiGraphContext(
  docKey: string | null,
  options?: AiGraphContextOptions,
): AiGraphNeighbor[] {
  if (!docKey) return []
  const maxHops = options?.twoHop ? 2 : 1
  return formatAiGraphNeighborList(collectRawGraphNeighbors(docKey, maxHops))
}
