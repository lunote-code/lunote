import type { GraphViewportNodeBounds } from '../graphViewportRuntime'

export type GraphBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  centerX: number
  centerY: number
  width: number
  height: number
}

/** Calculate node bounding box and geometric center (pure function).*/
export function computeGraphBounds(nodes: readonly GraphViewportNodeBounds[]): GraphBounds | null {
  if (nodes.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
}
