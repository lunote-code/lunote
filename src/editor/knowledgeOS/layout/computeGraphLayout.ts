/**
 * Minimal layout engine: topology → (x,y), independent of viewport.
 * Radial initial value + repulsion/gravity iteration + collision separation.
 */
import { markLayoutPhysicsActivity } from '../graphLayoutPhysicsHeartbeat'

export type GraphLayoutNodeInput = {
  id: string
}

export type GraphLayoutEdgeInput = {
  from: string
  to: string
}

export type GraphLayoutOptions = {
  centerNodeId?: string | null
  minNodeDistance?: number
  linkIdealLength?: number
  iterations?: number
}

const DEFAULT_MIN_DIST = 52
const DEFAULT_LINK = 96
const DEFAULT_ITERATIONS = 96
const LARGE_GRAPH_NODE_THRESHOLD = 180
const LARGE_GRAPH_PAIR_STRIDE = 3

type SimNode = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  pinned: boolean
}

function buildAdjacency(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const n of nodes) adj.set(n.id, new Set())
  for (const e of edges) {
    adj.get(e.from)?.add(e.to)
    adj.get(e.to)?.add(e.from)
  }
  return adj
}

function pickCenterId(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  preferred: string | null | undefined,
): string {
  if (preferred && nodes.some((n) => n.id === preferred)) return preferred
  const degree = new Map<string, number>()
  for (const n of nodes) degree.set(n.id, 0)
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  let best = nodes[0]?.id ?? ''
  let bestDeg = -1
  for (const n of nodes) {
    const d = degree.get(n.id) ?? 0
    if (d > bestDeg) {
      bestDeg = d
      best = n.id
    }
  }
  return best
}

function bfsLayers(adj: Map<string, Set<string>>, centerId: string): Map<string, number> {
  const layers = new Map<string, number>()
  const q: string[] = [centerId]
  layers.set(centerId, 0)
  while (q.length > 0) {
    const cur = q.shift()!
    const d = layers.get(cur) ?? 0
    for (const nb of adj.get(cur) ?? []) {
      if (!layers.has(nb)) {
        layers.set(nb, d + 1)
        q.push(nb)
      }
    }
  }
  for (const id of adj.keys()) {
    if (!layers.has(id)) layers.set(id, (layers.get(centerId) ?? 0) + 2)
  }
  return layers
}

function initialRadialPositions(
  nodes: GraphLayoutNodeInput[],
  layers: Map<string, number>,
  centerId: string,
  linkIdeal: number,
): SimNode[] {
  const byLayer = new Map<number, string[]>()
  for (const n of nodes) {
    const L = layers.get(n.id) ?? 1
    const list = byLayer.get(L) ?? []
    list.push(n.id)
    byLayer.set(L, list)
  }

  const pos = new Map<string, SimNode>()
  for (const n of nodes) {
    pos.set(n.id, { id: n.id, x: 0, y: 0, vx: 0, vy: 0, pinned: n.id === centerId })
  }

  const center = pos.get(centerId)
  if (center) {
    center.x = 0
    center.y = 0
  }

  for (const [layer, ids] of byLayer) {
    if (layer === 0) continue
    const r = layer * linkIdeal * 1.15
    const count = ids.length
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2
      const sn = pos.get(id)!
      sn.x = Math.cos(angle) * r
      sn.y = Math.sin(angle) * r
    })
  }

  return [...pos.values()]
}

function resolveCollisions(sim: SimNode[], minDist: number, passes = 24): void {
  markLayoutPhysicsActivity('collision-resolve')
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!
        const b = sim[j]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        if (dist < 1e-6) {
          const angle = ((i + j) * 0.618) % 1 * Math.PI * 2
          dx = Math.cos(angle) * 0.01
          dy = Math.sin(angle) * 0.01
          dist = 0.01
        }
        if (dist >= minDist) continue
        const overlap = (minDist - dist) / 2
        const nx = dx / dist
        const ny = dy / dist
        if (!a.pinned) {
          a.x -= nx * overlap
          a.y -= ny * overlap
        }
        if (!b.pinned) {
          b.x += nx * overlap
          b.y += ny * overlap
        }
      }
    }
  }
}

function runForceSimulation(
  sim: SimNode[],
  edges: GraphLayoutEdgeInput[],
  minDist: number,
  linkIdeal: number,
  iterations: number,
): void {
  const idToSim = new Map(sim.map((n) => [n.id, n]))
  const largeGraph = sim.length >= LARGE_GRAPH_NODE_THRESHOLD

  for (let tick = 0; tick < iterations; tick++) {
    markLayoutPhysicsActivity('force-tick')
    for (const n of sim) {
      if (!n.pinned) {
        n.vx *= 0.88
        n.vy *= 0.88
      }
    }

    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        if (largeGraph) {
          const stride = LARGE_GRAPH_PAIR_STRIDE + (tick % 2)
          if ((i + j + tick) % stride !== 0) continue
        }
        const a = sim[i]!
        const b = sim[j]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distSq = dx * dx + dy * dy
        if (distSq < 1e-8) {
          dx = (j - i) * 0.1 + 0.01
          dy = 0.02
          distSq = dx * dx + dy * dy
        }
        const dist = Math.sqrt(distSq)
        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.55
          const fx = dx * force
          const fy = dy * force
          if (!a.pinned) {
            a.vx -= fx
            a.vy -= fy
          }
          if (!b.pinned) {
            b.vx += fx
            b.vy += fy
          }
        } else if (dist < minDist * 2.2) {
          const force = (minDist * 0.35) / distSq
          const fx = dx * force
          const fy = dy * force
          if (!a.pinned) {
            a.vx -= fx
            a.vy -= fy
          }
          if (!b.pinned) {
            b.vx += fx
            b.vy += fy
          }
        }
      }
    }

    for (const e of edges) {
      const a = idToSim.get(e.from)
      const b = idToSim.get(e.to)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.01
      const delta = dist - linkIdeal
      const force = delta * 0.04
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      if (!a.pinned) {
        a.vx += fx
        a.vy += fy
      }
      if (!b.pinned) {
        b.vx -= fx
        b.vy -= fy
      }
    }

    for (const n of sim) {
      if (n.pinned) continue
      n.x += n.vx
      n.y += n.vy
    }

    if (tick % (largeGraph ? 12 : 8) === (largeGraph ? 11 : 7)) {
      resolveCollisions(sim, minDist, largeGraph ? 2 : 4)
    }
  }

  resolveCollisions(sim, minDist, largeGraph ? 12 : 32)
}

/**
 * Assign layout coordinates to topology nodes (pure function, does not read viewport/route).
 */
export function computeGraphLayout(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  options?: GraphLayoutOptions,
): Map<string, { x: number; y: number }> {
  markLayoutPhysicsActivity('force-layout')
  const out = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return out

  const minDist = options?.minNodeDistance ?? DEFAULT_MIN_DIST
  const linkIdeal = options?.linkIdealLength ?? DEFAULT_LINK
  const baseIterations = options?.iterations ?? DEFAULT_ITERATIONS
  const iterationScale =
    nodes.length >= 240 ? 0.35 : nodes.length >= 180 ? 0.5 : nodes.length >= 120 ? 0.7 : 1
  const iterations = Math.max(24, Math.round(baseIterations * iterationScale))

  if (nodes.length === 1) {
    out.set(nodes[0]!.id, { x: 0, y: 0 })
    return out
  }

  const adj = buildAdjacency(nodes, edges)
  const centerId = pickCenterId(nodes, edges, options?.centerNodeId)
  const layers = bfsLayers(adj, centerId)
  const sim = initialRadialPositions(nodes, layers, centerId, linkIdeal)
  runForceSimulation(sim, edges, minDist, linkIdeal, iterations)

  for (const n of sim) {
    out.set(n.id, { x: n.x, y: n.y })
  }
  return out
}

export const GRAPH_LAYOUT_MIN_NODE_DISTANCE = DEFAULT_MIN_DIST

/** O(n) grid occupancy: used in the first frame/boot stage, without running force simulation.*/
export function computeGridLayoutFallback(
  nodes: GraphLayoutNodeInput[],
  spacing = DEFAULT_MIN_DIST,
): Map<string, { x: number; y: number }> {
  markLayoutPhysicsActivity('grid-layout')
  const out = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return out
  if (nodes.length === 1) {
    out.set(nodes[0]!.id, { x: 0, y: 0 })
    return out
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  nodes.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    out.set(n.id, {
      x: (col - (cols - 1) / 2) * spacing,
      y: (row - (Math.ceil(nodes.length / cols) - 1) / 2) * spacing,
    })
  })
  return out
}
