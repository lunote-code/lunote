import type { NoteGraphNode } from '../types'

export type GraphViewportTransform = {
  panX: number
  panY: number
  zoom: number
  width: number
  height: number
}

export type GraphNodeSpatialIndex = {
  cellSize: number
  buckets: Map<string, NoteGraphNode[]>
}

function bucketKey(cellX: number, cellY: number): string {
  return `${cellX},${cellY}`
}

export function buildGraphNodeSpatialIndex(
  nodes: readonly NoteGraphNode[],
  hitRadius = 14,
): GraphNodeSpatialIndex {
  const cellSize = Math.max(8, hitRadius * 2)
  const buckets = new Map<string, NoteGraphNode[]>()
  for (const node of nodes) {
    const cellX = Math.floor(node.x / cellSize)
    const cellY = Math.floor(node.y / cellSize)
    const key = bucketKey(cellX, cellY)
    const list = buckets.get(key)
    if (list) list.push(node)
    else buckets.set(key, [node])
  }
  return { cellSize, buckets }
}

/**
 * Screen coordinates → Graph world coordinates (consistent with GraphPanel SVG transform).
 * transform: translate(panX + W/2, panY + H/2) scale(zoom)
 */
export function screenToGraphWorld(
  clientX: number,
  clientY: number,
  graphGroup: SVGGElement | null,
  viewportFallback?: GraphViewportTransform | null,
): { x: number; y: number } | null {
  if (!graphGroup) return null
  const svg = graphGroup.ownerSVGElement
  if (!svg) return null

  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = graphGroup.getScreenCTM()
  if (ctm) {
    const local = pt.matrixTransform(ctm.inverse())
    return { x: local.x, y: local.y }
  }

  // WebView2 on Windows RDP/VPS sometimes returns null from getScreenCTM() even when the SVG is visible.
  if (!viewportFallback) return null
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return screenToGraphWorldFromViewport(
    clientX - rect.left,
    clientY - rect.top,
    viewportFallback,
  )
}

/** Use viewport parameter conversion (for testing without DOM).*/
export function screenToGraphWorldFromViewport(
  svgClientX: number,
  svgClientY: number,
  transform: GraphViewportTransform,
): { x: number; y: number } {
  const { panX, panY, zoom, width, height } = transform
  const cx = svgClientX - width / 2 - panX
  const cy = svgClientY - height / 2 - panY
  return { x: cx / zoom, y: cy / zoom }
}

export function findGraphNodeAtWorld(
  worldX: number,
  worldY: number,
  nodes: readonly NoteGraphNode[],
  hitRadius = 14,
): NoteGraphNode | null {
  let best: NoteGraphNode | null = null
  let bestDist = hitRadius

  for (const n of nodes) {
    const d = Math.hypot(worldX - n.x, worldY - n.y)
    if (d <= bestDist) {
      bestDist = d
      best = n
    }
  }
  return best
}

export function findGraphNodeAtWorldWithIndex(
  worldX: number,
  worldY: number,
  index: GraphNodeSpatialIndex | null,
  nodes: readonly NoteGraphNode[],
  hitRadius = 14,
): NoteGraphNode | null {
  if (!index) return findGraphNodeAtWorld(worldX, worldY, nodes, hitRadius)
  let best: NoteGraphNode | null = null
  let bestDist = hitRadius
  const minCellX = Math.floor((worldX - hitRadius) / index.cellSize)
  const maxCellX = Math.floor((worldX + hitRadius) / index.cellSize)
  const minCellY = Math.floor((worldY - hitRadius) / index.cellSize)
  const maxCellY = Math.floor((worldY + hitRadius) / index.cellSize)
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const list = index.buckets.get(bucketKey(cellX, cellY))
      if (!list) continue
      for (const n of list) {
        const d = Math.hypot(worldX - n.x, worldY - n.y)
        if (d <= bestDist) {
          bestDist = d
          best = n
        }
      }
    }
  }
  return best
}

export function findGraphNodeAtScreen(
  clientX: number,
  clientY: number,
  graphGroup: SVGGElement | null,
  nodes: readonly NoteGraphNode[],
  hitRadius = 14,
  index: GraphNodeSpatialIndex | null = null,
  viewportFallback?: GraphViewportTransform | null,
): NoteGraphNode | null {
  const world = screenToGraphWorld(clientX, clientY, graphGroup, viewportFallback)
  if (!world) return null
  return findGraphNodeAtWorldWithIndex(world.x, world.y, index, nodes, hitRadius)
}
