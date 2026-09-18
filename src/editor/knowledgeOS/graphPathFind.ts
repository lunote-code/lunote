import type { NoteGraphEdge } from './types'

export type GraphPathResult = {
  nodeIds: string[]
  edgeIds: string[]
}

/** Undirected BFS shortest path between two rendered graph nodes. */
export function findShortestGraphPath(
  startId: string,
  endId: string,
  edges: readonly NoteGraphEdge[],
  maxHops = 8,
): GraphPathResult | null {
  if (startId === endId) {
    return { nodeIds: [startId], edgeIds: [] }
  }

  const adjacency = new Map<string, Array<{ neighborId: string; edgeId: string }>>()
  for (const edge of edges) {
    const aList = adjacency.get(edge.from) ?? []
    aList.push({ neighborId: edge.to, edgeId: edge.id })
    adjacency.set(edge.from, aList)
    const bList = adjacency.get(edge.to) ?? []
    bList.push({ neighborId: edge.from, edgeId: edge.id })
    adjacency.set(edge.to, bList)
  }

  const queue: string[] = [startId]
  const visited = new Set<string>([startId])
  const previous = new Map<string, { nodeId: string; edgeId: string }>()
  let depth = 0

  while (queue.length > 0 && depth < maxHops) {
    const levelSize = queue.length
    depth += 1
    for (let i = 0; i < levelSize; i += 1) {
      const current = queue.shift()
      if (!current) continue
      for (const { neighborId, edgeId } of adjacency.get(current) ?? []) {
        if (visited.has(neighborId)) continue
        visited.add(neighborId)
        previous.set(neighborId, { nodeId: current, edgeId })
        if (neighborId === endId) {
          return reconstructPath(startId, endId, previous)
        }
        queue.push(neighborId)
      }
    }
  }

  return null
}

function reconstructPath(
  startId: string,
  endId: string,
  previous: Map<string, { nodeId: string; edgeId: string }>,
): GraphPathResult {
  const nodeIds: string[] = [endId]
  const edgeIds: string[] = []
  let cursor = endId
  while (cursor !== startId) {
    const step = previous.get(cursor)
    if (!step) break
    edgeIds.unshift(step.edgeId)
    nodeIds.unshift(step.nodeId)
    cursor = step.nodeId
  }
  return { nodeIds, edgeIds }
}
