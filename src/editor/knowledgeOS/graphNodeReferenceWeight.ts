import { getBacklinksForDoc } from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

export const BASE_NODE_RADIUS = 5.5
export const NODE_RADIUS_STEP = 2.1
export const MAX_NODE_RADIUS = 16
export const CENTER_NODE_RADIUS_BONUS = 2

export type GraphNodeReferenceInput = {
  id: string
  docKey?: DocKey
  status?: 'resolved' | 'unresolved'
}

export function buildGraphSubgraphLinkCounts(
  edges: readonly { from: string; to: string }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const edge of edges) {
    counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1)
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1)
  }
  return counts
}

function nodeDocKeyFromGraphId(nodeId: string): DocKey {
  if (nodeId.startsWith('page:')) return nodeId.slice('page:'.length)
  if (nodeId.startsWith('heading:')) {
    const parts = nodeId.split(':')
    return parts[1] ?? nodeId
  }
  return nodeId.replace(/^page:/u, '')
}

/** Vault backlinks blended with visible subgraph degree — larger means more referenced / connected. */
export function resolveGraphNodeReferenceCount(
  node: GraphNodeReferenceInput,
  subgraphLinkCount: number,
): number {
  if (node.id.startsWith('heading:')) {
    return Math.max(1, subgraphLinkCount)
  }
  if (node.status === 'unresolved') {
    return Math.max(1, subgraphLinkCount)
  }
  const docKey = node.docKey ?? nodeDocKeyFromGraphId(node.id)
  const vaultReferences = getBacklinksForDoc(docKey).length
  return Math.max(subgraphLinkCount, vaultReferences, 1)
}

export function buildGraphNodeReferenceCounts(
  nodes: readonly GraphNodeReferenceInput[],
  edges: readonly { from: string; to: string }[],
): Map<string, number> {
  const subgraph = buildGraphSubgraphLinkCounts(edges)
  const counts = new Map<string, number>()
  for (const node of nodes) {
    counts.set(node.id, resolveGraphNodeReferenceCount(node, subgraph.get(node.id) ?? 0))
  }
  return counts
}

export function estimateGraphNodeRadius(
  node: { id: string; status?: 'resolved' | 'unresolved' },
  referenceCount: number,
  isFocused: boolean,
): number {
  const weight = Math.max(1, referenceCount)
  const weightedRadius = Math.min(
    MAX_NODE_RADIUS,
    BASE_NODE_RADIUS + Math.sqrt(weight) * NODE_RADIUS_STEP,
  )
  if (node.id.startsWith('heading:')) {
    return Math.max(4.5, weightedRadius - 1.5)
  }
  if (node.status === 'unresolved') {
    return Math.max(BASE_NODE_RADIUS, weightedRadius - 0.75)
  }
  return Math.min(
    MAX_NODE_RADIUS + CENTER_NODE_RADIUS_BONUS,
    weightedRadius + (isFocused ? CENTER_NODE_RADIUS_BONUS : 0),
  )
}
