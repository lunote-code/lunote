import { mindmapTheme } from './mindmapTheme'
import type { LayoutNode } from './layoutMindmap'

export function rectsOverlap(a: LayoutNode, b: LayoutNode): boolean {
  if (a.id === b.id) return false
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y
}

export function assertMindmapNodesDoNotOverlap(nodes: LayoutNode[]): void {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (rectsOverlap(nodes[i]!, nodes[j]!)) {
        throw new Error(`Mindmap layout overlap: ${nodes[i]!.id} ↔ ${nodes[j]!.id}`)
      }
    }
  }
}

/** The vertical spacing between parent and child nodes should be no less than the theme levelSpacing (parent bottom → child top)*/
export function assertMindmapParentChildSpacing(
  nodes: LayoutNode[],
  edges: ReadonlyArray<{ from: string; to: string }>,
  minSpacing = mindmapTheme.levelSpacing,
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const e of edges) {
    const from = byId.get(e.from)
    const to = byId.get(e.to)
    if (!from || !to) continue
    const gap = to.y - (from.y + from.height)
    if (gap < minSpacing * 0.35) {
      throw new Error(
        `Mindmap parent-child spacing too tight (${e.from}→${e.to}): ${gap.toFixed(1)}px < ${minSpacing}px`,
      )
    }
  }
}
