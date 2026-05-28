import { Graph } from 'dagre-d3-es/src/graphlib/index.js'
import { layout } from 'dagre-d3-es/src/dagre/layout.js'

import { mindmapTheme } from './mindmapTheme'
import type { MindmapTreeNode } from './parseMindmap'

export type LayoutNode = {
  id: string
  label: string
  level: number
  x: number
  y: number
  width: number
  height: number
}

export type LayoutEdge = {
  from: string
  to: string
}

export type MindmapLayout = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

function measureLabel(label: string, level: number): { width: number; height: number } {
  const fs = mindmapTheme.fontSize
  const pad = mindmapTheme.nodePadding
  const charW = fs * 0.58
  const w = Math.min(280, Math.max(48, label.length * charW + pad * 2))
  const h = fs * 1.45 + pad * 2 + (level === 0 ? 4 : 0)
  return { width: w, height: h }
}

function walkTree(
  node: MindmapTreeNode,
  parentId: string | null,
  g: Graph,
  edges: LayoutEdge[],
): void {
  const { width, height } = measureLabel(node.label, node.level)
  g.setNode(node.id, { width, height, label: node.label, level: node.level })
  if (parentId) {
    g.setEdge(parentId, node.id, {})
    edges.push({ from: parentId, to: node.id })
  }
  for (const child of node.children) walkTree(child, node.id, g, edges)
}

/** Use dagre to calculate tree layout (preview layer only)*/
export function layoutMindmapTree(root: MindmapTreeNode): MindmapLayout {
  const g = new Graph({ multigraph: false, compound: false })
  g.setGraph({
    rankdir: 'TB',
    nodesep: mindmapTheme.siblingGap,
    ranksep: mindmapTheme.levelSpacing,
    marginx: 24,
    marginy: 24,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const edges: LayoutEdge[] = []
  walkTree(root, null, g, edges)
  layout(g, {})

  const nodes: LayoutNode[] = []
  let maxX = 0
  let maxY = 0
  g.nodes().forEach((id) => {
    const n = g.node(id) as { x: number; y: number; width: number; height: number; label: string; level: number }
    const x = n.x - n.width / 2
    const y = n.y - n.height / 2
    nodes.push({
      id,
      label: n.label,
      level: n.level,
      x,
      y,
      width: n.width,
      height: n.height,
    })
    maxX = Math.max(maxX, x + n.width)
    maxY = Math.max(maxY, y + n.height)
  })

  return {
    nodes,
    edges,
    width: maxX + 32,
    height: maxY + 32,
  }
}
