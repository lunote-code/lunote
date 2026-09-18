import { getDocumentMeta } from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import type { NoteGraphEdge, NoteGraphNode } from './types'

export type GraphRecentActivityWindow = 'all' | '7d' | '30d' | '90d'

const WINDOW_MS: Record<Exclude<GraphRecentActivityWindow, 'all'>, number> = {
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
}

function parseFrontmatterTimestamp(frontmatter: Record<string, unknown>): number | null {
  for (const key of ['updated', 'modified', 'date', 'created']) {
    const value = frontmatter[key]
    if (typeof value === 'string') {
      const parsed = Date.parse(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function nodeDocKey(node: NoteGraphNode): DocKey | null {
  if (node.id.startsWith('heading:')) {
    const parts = node.id.split(':')
    return parts[1] ?? null
  }
  return node.docKey
}

export function docMatchesRecentActivityWindow(
  docKey: DocKey,
  window: GraphRecentActivityWindow,
): boolean {
  if (window === 'all') return true
  const meta = getDocumentMeta(docKey)
  if (!meta) return false
  const timestamp = parseFrontmatterTimestamp(meta.frontmatter)
  if (timestamp === null) return true
  return timestamp >= Date.now() - WINDOW_MS[window]
}

export function applyGraphRecentActivityFilter(
  nodes: readonly NoteGraphNode[],
  edges: readonly NoteGraphEdge[],
  window: GraphRecentActivityWindow,
  routeCenter: DocKey | null = null,
): { nodes: NoteGraphNode[]; edges: NoteGraphEdge[] } {
  if (window === 'all') {
    return { nodes: [...nodes], edges: [...edges] }
  }

  const allowedDocs = new Set<DocKey>()
  if (routeCenter) allowedDocs.add(routeCenter)
  for (const node of nodes) {
    const docKey = nodeDocKey(node)
    if (!docKey) continue
    if (docMatchesRecentActivityWindow(docKey, window)) {
      allowedDocs.add(docKey)
    }
  }

  const visibleNodeIds = new Set<string>()
  const filteredNodes: NoteGraphNode[] = []
  for (const node of nodes) {
    const docKey = nodeDocKey(node)
    if (!docKey || !allowedDocs.has(docKey)) continue
    visibleNodeIds.add(node.id)
    filteredNodes.push(node)
  }

  const filteredEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
  )

  return { nodes: filteredNodes, edges: filteredEdges }
}
