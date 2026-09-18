export type GraphFitNodeBounds = {
  x: number
  y: number
  radius?: number
  labelChars?: number
}

export const GRAPH_LABEL_OFFSET_Y = 10
export const GRAPH_LABEL_HEIGHT = 14
export const GRAPH_LABEL_CHAR_WIDTH = 5
export const GRAPH_LABEL_MAX_CHARS = 24

const LABEL_OFFSET_Y = GRAPH_LABEL_OFFSET_Y
const LABEL_HEIGHT = GRAPH_LABEL_HEIGHT
const LABEL_CHAR_WIDTH = GRAPH_LABEL_CHAR_WIDTH
const MAX_LABEL_CHARS_FOR_FIT = GRAPH_LABEL_MAX_CHARS

/** Half-width of a node label footprint (matches fit bounds). */
export function estimateGraphLabelHalfWidth(labelChars: number): number {
  const chars = Math.min(Math.max(labelChars, 0), GRAPH_LABEL_MAX_CHARS)
  return (chars * GRAPH_LABEL_CHAR_WIDTH) / 2
}

/** Extra center-to-center gap so labels below nodes stay separated during layout. */
export function estimateGraphLabelFootprintSeparation(
  labelCharsA: number,
  labelCharsB: number,
): number {
  const horizontal =
    (estimateGraphLabelHalfWidth(labelCharsA) + estimateGraphLabelHalfWidth(labelCharsB)) * 0.68
  const vertical = GRAPH_LABEL_OFFSET_Y + GRAPH_LABEL_HEIGHT * 0.32
  return horizontal + vertical
}

import { estimateGraphNodeRadius } from '../graphNodeReferenceWeight'

function hasFitExtensions(nodes: readonly GraphFitNodeBounds[]): boolean {
  return nodes.some((n) => n.radius != null || n.labelChars != null)
}

/** Expand node centers into a content bounding box including dot radius and label footprint. */
export function expandGraphFitBounds(
  nodes: readonly GraphFitNodeBounds[],
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (nodes.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const r = n.radius ?? 0
    const labelChars = n.labelChars ?? 0
    const labelWidth = Math.min(labelChars, MAX_LABEL_CHARS_FOR_FIT) * LABEL_CHAR_WIDTH
    const halfLabelW = labelWidth / 2
    const labelBottom = r + LABEL_OFFSET_Y + LABEL_HEIGHT

    minX = Math.min(minX, n.x - r - halfLabelW)
    maxX = Math.max(maxX, n.x + r + halfLabelW)
    minY = Math.min(minY, n.y - r)
    maxY = Math.max(maxY, n.y + labelBottom)
  }

  return { minX, maxX, minY, maxY }
}

export function estimateGraphNodeFitRadius(
  node: { id: string; status: 'resolved' | 'unresolved' },
  referenceCount: number,
  isFocused: boolean,
): number {
  return estimateGraphNodeRadius(node, referenceCount, isFocused)
}

export function buildGraphFitNodeBounds(
  nodes: readonly {
    id: string
    x: number
    y: number
    label: string
    status: 'resolved' | 'unresolved'
  }[],
  options?: {
    referenceCountByNodeId?: ReadonlyMap<string, number>
    /** @deprecated use referenceCountByNodeId */
    linkCountByNodeId?: ReadonlyMap<string, number>
    highlightedId?: string | null
  },
): GraphFitNodeBounds[] {
  const referenceCounts =
    options?.referenceCountByNodeId ?? options?.linkCountByNodeId
  const highlightedId = options?.highlightedId ?? null
  return nodes.map((n) => ({
    x: n.x,
    y: n.y,
    radius: estimateGraphNodeFitRadius(
      n,
      referenceCounts?.get(n.id) ?? 0,
      highlightedId === n.id,
    ),
    labelChars: n.label.length,
  }))
}

export function resolveGraphFitBounds(
  nodes: readonly GraphFitNodeBounds[],
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (nodes.length === 0) return null

  if (hasFitExtensions(nodes)) {
    return expandGraphFitBounds(nodes)
  }

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
  return { minX, maxX, minY, maxY }
}

export function nodeHasFitExtensions(nodes: readonly GraphFitNodeBounds[]): boolean {
  return hasFitExtensions(nodes)
}

/** Longest axis of label-aware fit bounds; used to defer fit until layout positions spread. */
export function measureGraphFitBoundsSpan(nodes: readonly GraphFitNodeBounds[]): number {
  const bounds = resolveGraphFitBounds(nodes)
  if (!bounds) return 0
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
}

/** Longest axis between node centers (ignores label/radius padding). */
export function measureGraphNodeCenterSpan(
  nodes: readonly { x: number; y: number }[],
): number {
  if (nodes.length <= 1) return Number.POSITIVE_INFINITY
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
  return Math.max(maxX - minX, maxY - minY, 0)
}
