import type { NoteGraphNode } from './types'

type GraphNodePosition = { x: number; y: number }

const overrides = new Map<string, GraphNodePosition>()
const listeners = new Set<() => void>()

export function getGraphNodePositionOverride(nodeId: string): GraphNodePosition | undefined {
  return overrides.get(nodeId)
}

export function setGraphNodePositionOverride(nodeId: string, position: GraphNodePosition): void {
  const prev = overrides.get(nodeId)
  if (prev && prev.x === position.x && prev.y === position.y) return
  overrides.set(nodeId, position)
  for (const listener of listeners) listener()
}

export function applyGraphNodePositionOverrides(nodes: readonly NoteGraphNode[]): NoteGraphNode[] {
  if (overrides.size === 0) return nodes as NoteGraphNode[]
  let changed = false
  const next = nodes.map((node) => {
    const override = overrides.get(node.id)
    if (!override || (override.x === node.x && override.y === node.y)) return node
    changed = true
    return { ...node, x: override.x, y: override.y }
  })
  return changed ? next : (nodes as NoteGraphNode[])
}

export function clearGraphNodePositionOverrides(): void {
  if (overrides.size === 0) return
  overrides.clear()
  for (const listener of listeners) listener()
}

export function subscribeGraphNodePositionOverrides(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
