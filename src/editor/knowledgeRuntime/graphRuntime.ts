import { subscribeKnowledgeEvents } from './knowledgeEvents'
import { getGraphSnapshot } from './linkGraph'
import type { GraphEdge, GraphNode } from './types'

export type GraphLayoutNode = GraphNode & {
  x: number
  y: number
  vx: number
  vy: number
}

export type GraphViewState = {
  nodes: GraphLayoutNode[]
  edges: GraphEdge[]
  revision: number
  viewport: { x: number; y: number; zoom: number }
  clustering: boolean
  cullingEnabled: boolean
}

const viewState: GraphViewState = {
  nodes: [],
  edges: [],
  revision: 0,
  viewport: { x: 0, y: 0, zoom: 1 },
  clustering: false,
  cullingEnabled: true,
}

const listeners = new Set<() => void>()
let unsubscribeEvents: (() => void) | null = null

function hashLayoutSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (h >>> 0) / 0xffffffff
}

function layoutNodesIncremental(nodes: GraphNode[]): GraphLayoutNode[] {
  const prev = new Map(viewState.nodes.map((n) => [n.id, n]))
  return nodes.map((n) => {
    const existing = prev.get(n.id)
    if (existing) return { ...existing, ...n }
    const seed = hashLayoutSeed(n.id)
    const angle = seed * Math.PI * 2
    const r = 120 + seed * 280
    return {
      ...n,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    }
  })
}

export function refreshGraphViewIncremental(): void {
  const { nodes, edges } = getGraphSnapshot()
  viewState.nodes = layoutNodesIncremental(nodes)
  viewState.edges = edges
  viewState.revision += 1
  listeners.forEach((fn) => fn())
}

export function subscribeGraphView(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGraphViewState(): Readonly<GraphViewState> {
  return viewState
}

export function setGraphViewport(viewport: { x: number; y: number; zoom: number }): void {
  viewState.viewport = viewport
  listeners.forEach((fn) => fn())
}

export function getVisibleNodes(
  width: number,
  height: number,
  padding = 80,
): GraphLayoutNode[] {
  if (!viewState.cullingEnabled) return viewState.nodes
  const { x, y, zoom } = viewState.viewport
  const minX = (-x - padding) / zoom
  const minY = (-y - padding) / zoom
  const maxX = (width - x + padding) / zoom
  const maxY = (height - y + padding) / zoom
  return viewState.nodes.filter(
    (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY,
  )
}

/** Lightweight async layout tick (does not block main thread input)*/
export function scheduleGraphLayoutTick(
  iterations = 1,
  onFrame?: () => void,
): void {
  let remaining = iterations
  const step = () => {
    if (remaining <= 0) {
      onFrame?.()
      return
    }
    remaining -= 1
    applyForceStep(0.02)
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function applyForceStep(alpha: number): void {
  const nodes = viewState.nodes
  const edges = viewState.edges
  for (const n of nodes) {
    n.vx += (0 - n.x) * alpha * 0.1
    n.vy += (0 - n.y) * alpha * 0.1
  }
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.from)
    const b = nodes.find((n) => n.id === e.to)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = (dist - 90) * alpha * 0.05
    a.vx += (dx / dist) * force
    a.vy += (dy / dist) * force
    b.vx -= (dx / dist) * force
    b.vy -= (dy / dist) * force
  }
  for (const n of nodes) {
    n.x += n.vx
    n.y += n.vy
    n.vx *= 0.6
    n.vy *= 0.6
  }
  viewState.revision += 1
}

export function ensureGraphRuntimeListening(): void {
  if (unsubscribeEvents) return
  unsubscribeEvents = subscribeKnowledgeEvents((ev) => {
    if (ev.kind === 'graph-updated' || ev.kind === 'index-updated') {
      refreshGraphViewIncremental()
    }
  })
}

export function resetGraphRuntime(): void {
  viewState.nodes = []
  viewState.edges = []
  viewState.revision = 0
  listeners.clear()
  if (unsubscribeEvents) {
    unsubscribeEvents()
    unsubscribeEvents = null
  }
}
