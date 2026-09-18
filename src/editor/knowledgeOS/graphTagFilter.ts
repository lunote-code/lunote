import { getDocumentsByTag } from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import type { NoteGraphEdge, NoteGraphNode } from './types'

function nodeDocKeyForTagFilter(node: NoteGraphNode): DocKey | null {
  if (node.id.startsWith('heading:')) {
    const parts = node.id.split(':')
    return parts[1] ?? null
  }
  return node.docKey
}

export function applyGraphTagFilter(
  nodes: readonly NoteGraphNode[],
  edges: readonly NoteGraphEdge[],
  filterTag: string | null,
  routeCenter: DocKey | null = null,
): { nodes: NoteGraphNode[]; edges: NoteGraphEdge[] } {
  const normalizedTag = filterTag?.trim().toLowerCase()
  if (!normalizedTag) {
    return { nodes: [...nodes], edges: [...edges] }
  }

  const taggedDocs = new Set(getDocumentsByTag(normalizedTag))
  if (routeCenter) taggedDocs.add(routeCenter)

  const visibleNodeIds = new Set<string>()
  const filteredNodes: NoteGraphNode[] = []
  for (const node of nodes) {
    const docKey = nodeDocKeyForTagFilter(node)
    if (!docKey || !taggedDocs.has(docKey)) continue
    visibleNodeIds.add(node.id)
    filteredNodes.push(node)
  }

  const filteredEdges = edges.filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
  )

  return { nodes: filteredNodes, edges: filteredEdges }
}
