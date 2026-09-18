/**
 * Minimal layout engine: topology → (x,y), independent of viewport.
 * Radial initial value + repulsion/gravity iteration + collision separation.
 */
import { markLayoutPhysicsActivity } from '../graphLayoutPhysicsHeartbeat'
import {
  estimateGraphLabelFootprintSeparation,
  estimateGraphLabelHalfWidth,
} from './graphFitBounds'

export type GraphLayoutNodeInput = {
  id: string
}

export type GraphLayoutEdgeInput = {
  from: string
  to: string
}

export type GraphLayoutDensity = 'normal' | 'dense'

export type GraphLayoutScope = 'local' | 'global'

export type GraphLayoutOptions = {
  centerNodeId?: string | null
  minNodeDistance?: number
  linkIdealLength?: number
  iterations?: number
  /** Dense local subgraph (headings + unresolved + hub neighbors). */
  layoutDensity?: GraphLayoutDensity
  /** Global workspace graph spreads nodes; local subgraph may hub-sector around center. */
  layoutScope?: GraphLayoutScope
  /** Seed positions from a prior layout (incremental relayout after graph edits). */
  initialPositions?: ReadonlyMap<string, { x: number; y: number }>
  /** Keep these nodes fixed while the simulation settles around them. */
  pinNodeIds?: ReadonlySet<string>
  /** Reference weight per node — larger hubs get more collision space and pull cluster layout. */
  nodeReferenceWeights?: ReadonlyMap<string, number>
  /** Label character count per node — expands collision radius for long labels. */
  nodeLabelChars?: ReadonlyMap<string, number>
}

const DEFAULT_MIN_DIST = 52
const DEFAULT_LINK = 96
const DEFAULT_ITERATIONS = 96
const LINK_SPRING_FORCE = 0.055
const SMALL_GRAPH_SPRING_FORCE = 0.041
const SMALL_GRAPH_BRANCH_LAYOUT_MAX = 24
const LARGE_GRAPH_NODE_THRESHOLD = 180
const LARGE_GRAPH_PAIR_STRIDE = 3
/** Golden angle — phyllotaxis spiral for organic multi-component packing. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function hashString(value: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic [0, 1) jitter from a string (stable across layout runs). */
function hashUnit(value: string): number {
  return hashString(value) / 4294967296
}

function rotatePoint(x: number, y: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: x * c - y * s, y: x * s + y * c }
}

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

function layoutReferenceWeight(id: string, weights?: ReadonlyMap<string, number>): number {
  return Math.max(1, weights?.get(id) ?? 1)
}

function pairMinNodeDistance(
  idA: string,
  idB: string,
  baseMinDist: number,
  weights?: ReadonlyMap<string, number>,
  labelChars?: ReadonlyMap<string, number>,
): number {
  const wa = layoutReferenceWeight(idA, weights)
  const wb = layoutReferenceWeight(idB, weights)
  const hubPad = (Math.sqrt(wa) + Math.sqrt(wb)) * 3.1
  const labelPad = estimateGraphLabelFootprintSeparation(
    labelChars?.get(idA) ?? 0,
    labelChars?.get(idB) ?? 0,
  )
  return baseMinDist + hubPad + labelPad
}

function pickCenterId(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  preferred: string | null | undefined,
  weights?: ReadonlyMap<string, number>,
): string {
  if (preferred && nodes.some((n) => n.id === preferred)) return preferred
  const degree = new Map<string, number>()
  for (const n of nodes) degree.set(n.id, 0)
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  let best = nodes[0]?.id ?? ''
  let bestScore = -1
  for (const n of nodes) {
    const score = Math.max(degree.get(n.id) ?? 0, layoutReferenceWeight(n.id, weights))
    if (score > bestScore) {
      bestScore = score
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

type GraphDensityProfile = {
  isDense: boolean
  headingCount: number
  hubDegree: number
  edgeDensity: number
}

function isHeadingNodeId(id: string): boolean {
  return id.startsWith('heading:')
}

function neighborSortRank(id: string): number {
  if (isHeadingNodeId(id)) return 2
  if (id.startsWith('unresolved:')) return 1
  return 0
}

function analyzeGraphDensity(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  centerId: string,
  adj: Map<string, Set<string>>,
  options?: GraphLayoutOptions,
): GraphDensityProfile {
  const headingCount = nodes.filter((n) => isHeadingNodeId(n.id)).length
  const hubDegree = adj.get(centerId)?.size ?? 0
  const edgeDensity = nodes.length > 0 ? edges.length / nodes.length : 0
  const isDense =
    options?.layoutDensity === 'dense' ||
    headingCount >= 3 ||
    (headingCount >= 2 && edgeDensity >= 1.35) ||
    (hubDegree >= 5 && nodes.length <= SMALL_GRAPH_BRANCH_LAYOUT_MAX) ||
    (hubDegree >= 4 && headingCount >= 2 && nodes.length <= 40) ||
    (edgeDensity >= 1.75 && nodes.length >= 10 && headingCount >= 1)
  return { isDense, headingCount, hubDegree, edgeDensity }
}

function resolveLayoutScales(
  nodeCount: number,
  edgeCount: number,
  options?: GraphLayoutOptions,
  profile?: GraphDensityProfile,
): { minDist: number; linkIdeal: number; iterations: number } {
  if (
    options?.minNodeDistance != null &&
    options.linkIdealLength != null &&
    options.iterations != null
  ) {
    return {
      minDist: options.minNodeDistance,
      linkIdeal: options.linkIdealLength,
      iterations: options.iterations,
    }
  }

  const density = nodeCount > 0 ? edgeCount / nodeCount : 0
  const isDense = profile?.isDense ?? options?.layoutDensity === 'dense'
  const isGlobal = options?.layoutScope === 'global'

  if (isGlobal && isDense && nodeCount <= 120) {
    const headingBoost = Math.min(profile?.headingCount ?? 0, 8) * 3
    const hubBoost = Math.min(profile?.hubDegree ?? 0, 12) * 2.5
    const sizeBoost = Math.min(nodeCount, 80) * 0.35
    return {
      minDist: options?.minNodeDistance ?? Math.round(96 + headingBoost + sizeBoost * 0.18),
      linkIdeal: options?.linkIdealLength ?? Math.round(142 + hubBoost + sizeBoost * 0.22),
      iterations: options?.iterations ?? 128,
    }
  }

  if (isGlobal && nodeCount > 12) {
    const sizeBoost = Math.min(nodeCount, 100) * 0.42
    return {
      minDist: options?.minNodeDistance ?? Math.round(78 + sizeBoost),
      linkIdeal: options?.linkIdealLength ?? Math.round(118 + sizeBoost * 0.55),
      iterations: options?.iterations ?? 112,
    }
  }

  if (isDense && nodeCount <= 40) {
    const headingBoost = Math.min(profile?.headingCount ?? 0, 6) * 2
    const hubBoost = Math.min(profile?.hubDegree ?? 0, 8) * 2
    return {
      minDist: options?.minNodeDistance ?? 78 + headingBoost,
      linkIdeal: options?.linkIdealLength ?? 118 + hubBoost,
      iterations: options?.iterations ?? 112,
    }
  }

  if (nodeCount <= 8) {
    return {
      minDist: options?.minNodeDistance ?? 86,
      linkIdeal: options?.linkIdealLength ?? 128,
      iterations: options?.iterations ?? 112,
    }
  }
  if (nodeCount <= SMALL_GRAPH_BRANCH_LAYOUT_MAX) {
    return {
      minDist: options?.minNodeDistance ?? 74,
      linkIdeal: options?.linkIdealLength ?? 112,
      iterations: options?.iterations ?? 100,
    }
  }
  if (nodeCount <= 40) {
    return {
      minDist: options?.minNodeDistance ?? (density >= 2 ? 66 : 58),
      linkIdeal: options?.linkIdealLength ?? 102,
      iterations: options?.iterations ?? DEFAULT_ITERATIONS,
    }
  }
  return {
    minDist: options?.minNodeDistance ?? DEFAULT_MIN_DIST,
    linkIdeal: options?.linkIdealLength ?? DEFAULT_LINK,
    iterations: options?.iterations ?? DEFAULT_ITERATIONS,
  }
}

function buildTreeFromCenter(
  adj: Map<string, Set<string>>,
  centerId: string,
  nodeIds: readonly string[],
): {
  children: Map<string, string[]>
  depth: Map<string, number>
  unreachable: string[]
} {
  const children = new Map<string, string[]>()
  const depth = new Map<string, number>()
  depth.set(centerId, 0)

  const q: string[] = [centerId]
  while (q.length > 0) {
    const cur = q.shift()!
    const d = depth.get(cur) ?? 0
    const neighbors = [...(adj.get(cur) ?? [])].sort()
    for (const nb of neighbors) {
      if (depth.has(nb)) continue
      depth.set(nb, d + 1)
      const list = children.get(cur) ?? []
      list.push(nb)
      children.set(cur, list)
      q.push(nb)
    }
  }

  for (const [id, kids] of children) {
    kids.sort()
    children.set(id, kids)
  }

  const unreachable = nodeIds.filter((id) => id !== centerId && !depth.has(id))
  return { children, depth, unreachable }
}

/** Branch wedges help tree-like subgraphs; skip star hubs and cross-linked clusters. */
function shouldUseBranchLayout(
  nodes: GraphLayoutNodeInput[],
  adj: Map<string, Set<string>>,
  centerId: string,
  profile: GraphDensityProfile,
): boolean {
  if (nodes.length <= 2 || nodes.length > SMALL_GRAPH_BRANCH_LAYOUT_MAX) return false
  if (profile.isDense) return false

  let edgeCount = 0
  for (const neighbors of adj.values()) {
    edgeCount += neighbors.size
  }
  edgeCount = Math.round(edgeCount / 2)
  if (edgeCount > nodes.length + Math.max(2, Math.floor(nodes.length * 0.12))) {
    return false
  }

  const rootDegree = adj.get(centerId)?.size ?? 0
  if (rootDegree >= 5) return false

  return rootDegree >= 2
}

/** Hub-sector seed — equal wedges for high-degree centers (headings placed later as satellites). */
function shouldUseHubSectorLayout(
  nodes: GraphLayoutNodeInput[],
  adj: Map<string, Set<string>>,
  centerId: string,
  profile: GraphDensityProfile,
  layoutScope?: GraphLayoutScope,
): boolean {
  if (layoutScope === 'global') return false
  if (nodes.length <= 2) return false
  const hubDegree = adj.get(centerId)?.size ?? 0
  if (profile.isDense) {
    return hubDegree >= 3
  }
  if (hubDegree < 5) return false
  // Large capped star subgraphs (mega-hub fixtures): hub connects to almost every node.
  if (hubDegree >= nodes.length - 2) return true
  return nodes.length <= SMALL_GRAPH_BRANCH_LAYOUT_MAX
}

function initialHubSectorPositions(
  nodes: GraphLayoutNodeInput[],
  adj: Map<string, Set<string>>,
  centerId: string,
  linkIdeal: number,
  labelChars?: ReadonlyMap<string, number>,
): SimNode[] {
  const layers = bfsLayers(adj, centerId)
  const pos = new Map<string, SimNode>()
  for (const n of nodes) {
    pos.set(n.id, { id: n.id, x: 0, y: 0, vx: 0, vy: 0, pinned: false })
  }

  const hubNeighbors = [...(adj.get(centerId) ?? [])].sort(
    (a, b) => neighborSortRank(a) - neighborSortRank(b) || a.localeCompare(b),
  )
  const hubDegree = hubNeighbors.length
  const radialScale = 1.24 + Math.min(hubDegree, 16) * 0.038
  const radialStep = linkIdeal * radialScale
  const startAngle = -Math.PI / 2 + (hashUnit(centerId) - 0.5) * 0.28
  const wedgeJitter = hubDegree >= 6 ? 0.18 : 0.12

  const angularWeights = hubNeighbors.map((id) => {
    if (isHeadingNodeId(id)) return 0
    const labelHalfW = estimateGraphLabelHalfWidth(labelChars?.get(id) ?? 0)
    return Math.max(1, 1 + labelHalfW / 36)
  })
  const angularTotal = angularWeights.reduce((sum, w) => sum + w, 0) || 1
  let angleCursor = startAngle

  hubNeighbors.forEach((id, i) => {
    if (isHeadingNodeId(id)) return
    const slice = (angularWeights[i]! / angularTotal) * Math.PI * 2
    const angle =
      angleCursor +
      slice / 2 +
      (hashUnit(`${id}:hub`) - 0.5) * slice * wedgeJitter
    angleCursor += slice
    const r = radialStep * (0.96 + hashUnit(`${id}:r`) * 0.22)
    const sn = pos.get(id)
    if (!sn) return
    sn.x = Math.cos(angle) * r
    sn.y = Math.sin(angle) * r
  })

  for (const n of nodes) {
    if (n.id === centerId) continue
    const sn = pos.get(n.id)
    if (!sn || (sn.x !== 0 || sn.y !== 0)) continue
    const layer = layers.get(n.id) ?? 2
    const rBase = layer * linkIdeal * 1.12
    const baseAngle = hashUnit(`${centerId}:${n.id}`) * Math.PI * 2
    const angle = baseAngle + (hashUnit(`${n.id}:a`) - 0.5) * 0.55
    const r = rBase * (0.86 + hashUnit(`${n.id}:r`) * 0.28)
    sn.x = Math.cos(angle) * r
    sn.y = Math.sin(angle) * r
  }

  return [...pos.values()]
}

function offsetHeadingNodesFromParents(
  sim: SimNode[],
  edges: GraphLayoutEdgeInput[],
  linkIdeal: number,
  minDist: number,
  layoutScope?: GraphLayoutScope,
): void {
  const isGlobal = layoutScope === 'global'
  const idToSim = new Map(sim.map((n) => [n.id, n]))
  const pageToHeadings = new Map<string, string[]>()
  for (const e of edges) {
    if (!isHeadingNodeId(e.to) || !e.from.startsWith('page:')) continue
    const list = pageToHeadings.get(e.from) ?? []
    list.push(e.to)
    pageToHeadings.set(e.from, list)
  }

  for (const [pageId, headingIds] of pageToHeadings) {
    headingIds.sort()
    const parent = idToSim.get(pageId)
    if (!parent) continue
    const parentDist = Math.hypot(parent.x, parent.y)
    const count = headingIds.length

    if (parentDist < 1e-3) {
      const ringR = linkIdeal * 1.08
      const startAngle = -Math.PI / 2 + (hashUnit(pageId) - 0.5) * 0.35
      const wedge = (Math.PI * 2) / Math.max(count, 1)
      headingIds.forEach((headingId, i) => {
        const heading = idToSim.get(headingId)
        if (!heading) return
        const angle = startAngle + (i + 0.5) * wedge + (hashUnit(`${headingId}:ring`) - 0.5) * wedge * 0.1
        heading.x = Math.cos(angle) * ringR
        heading.y = Math.sin(angle) * ringR
      })
      continue
    }

    const parentAngle = Math.atan2(parent.y, parent.x)
    const satelliteR = Math.max(
      minDist * (isGlobal ? 1.08 : 0.82),
      linkIdeal * (isGlobal ? 0.92 : 0.68),
    )
    const arcSpan = Math.min(
      Math.PI * (isGlobal ? 1.2 : 0.95),
      Math.max(isGlobal ? 0.58 : 0.42, count * (isGlobal ? 0.46 : 0.34)),
    )

    headingIds.forEach((headingId, i) => {
      const heading = idToSim.get(headingId)
      if (!heading) return
      const angleOffset =
        count === 1
          ? 0
          : (i - (count - 1) / 2) * (arcSpan / Math.max(count - 1, 1))
      const angle = parentAngle + angleOffset + (hashUnit(`${headingId}:sat`) - 0.5) * 0.08
      heading.x = parent.x + Math.cos(angle) * satelliteR
      heading.y = parent.y + Math.sin(angle) * satelliteR
    })
  }
}

/** Branch-sector tree seed — keeps subtrees in separate wedges (better for local subgraphs). */
function initialBranchSectorPositions(
  nodes: GraphLayoutNodeInput[],
  adj: Map<string, Set<string>>,
  centerId: string,
  linkIdeal: number,
): SimNode[] {
  const nodeIds = nodes.map((n) => n.id)
  const { children, depth, unreachable } = buildTreeFromCenter(adj, centerId, nodeIds)
  const pos = new Map<string, SimNode>()
  for (const n of nodes) {
    pos.set(n.id, { id: n.id, x: 0, y: 0, vx: 0, vy: 0, pinned: false })
  }

  const radialStep = linkIdeal * 1.16

  const placeSubtree = (id: string, angleStart: number, angleEnd: number): void => {
    const d = depth.get(id) ?? 1
    const r = d * radialStep * (0.92 + hashUnit(`${id}:r`) * 0.18)
    const angle = (angleStart + angleEnd) / 2 + (hashUnit(`${id}:a`) - 0.5) * 0.22
    const sn = pos.get(id)
    if (!sn) return
    sn.x = Math.cos(angle) * r
    sn.y = Math.sin(angle) * r

    const kids = children.get(id) ?? []
    if (kids.length === 0) return

    const span = angleEnd - angleStart
    const minWedge = Math.min(Math.max(span / kids.length, Math.PI / 9), Math.PI / 2.4)
    const useSpan = Math.max(span, minWedge * kids.length)
    const mid = (angleStart + angleEnd) / 2
    const start = mid - useSpan / 2
    const wedge = useSpan / kids.length
    kids.forEach((kid, i) => {
      placeSubtree(kid, start + i * wedge, start + (i + 1) * wedge)
    })
  }

  const rootKids = children.get(centerId) ?? []
  if (rootKids.length === 0) {
    return initialRadialPositions(nodes, bfsLayers(adj, centerId), centerId, linkIdeal)
  }

  const startAngle = -Math.PI / 2 + (hashUnit(centerId) - 0.5) * 0.35
  const wedge = (Math.PI * 2) / rootKids.length
  rootKids.forEach((kid, i) => {
    placeSubtree(kid, startAngle + i * wedge, startAngle + (i + 1) * wedge)
  })

  if (unreachable.length > 0) {
    const outerR = (Math.max(...[...depth.values()], 0) + 2) * radialStep
    unreachable.forEach((id, i) => {
      const angle = startAngle + ((i + 0.5) / unreachable.length) * Math.PI * 2
      const sn = pos.get(id)
      if (!sn) return
      sn.x = Math.cos(angle) * outerR
      sn.y = Math.sin(angle) * outerR
    })
  }

  return [...pos.values()]
}

function createInitialSimulation(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  adj: Map<string, Set<string>>,
  centerId: string,
  linkIdeal: number,
  minDist: number,
  useBranchLayout: boolean,
  useHubSectorLayout: boolean,
  labelChars?: ReadonlyMap<string, number>,
  layoutScope?: GraphLayoutScope,
): SimNode[] {
  let sim: SimNode[]
  if (useBranchLayout) {
    sim = initialBranchSectorPositions(nodes, adj, centerId, linkIdeal)
  } else if (useHubSectorLayout) {
    sim = initialHubSectorPositions(nodes, adj, centerId, linkIdeal, labelChars)
  } else {
    const layers = bfsLayers(adj, centerId)
    sim = initialRadialPositions(nodes, layers, centerId, linkIdeal, layoutScope)
  }
  offsetHeadingNodesFromParents(sim, edges, linkIdeal, minDist, layoutScope)
  return sim
}

function initialRadialPositions(
  nodes: GraphLayoutNodeInput[],
  layers: Map<string, number>,
  centerId: string,
  linkIdeal: number,
  layoutScope?: GraphLayoutScope,
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
    pos.set(n.id, { id: n.id, x: 0, y: 0, vx: 0, vy: 0, pinned: false })
  }

  const center = pos.get(centerId)
  if (center) {
    center.x = 0
    center.y = 0
  }

  for (const [layer, ids] of byLayer) {
    if (layer === 0) continue
    const globalSpreadBoost = layoutScope === 'global' ? 1.28 : 1
    const rBase = layer * linkIdeal * 1.08 * globalSpreadBoost
    const count = ids.length
    const spread =
      layoutScope === 'global'
        ? count <= 2
          ? 1.05
          : count <= 4
            ? 0.88
            : count <= 8
              ? 0.72
              : 0.58
        : count <= 2
          ? 0.85
          : count <= 4
            ? 0.62
            : count <= 8
              ? 0.48
              : 0.38
    ids.forEach((id, i) => {
      const baseAngle =
        count === 1
          ? hashUnit(`${centerId}:${id}`) * Math.PI * 2
          : -Math.PI / 2 + (i + hashUnit(id) * 0.72) * ((Math.PI * 2) / Math.max(count, 1))
      const angle = baseAngle + (hashUnit(`${id}:a`) - 0.5) * spread
      const r = rBase * (0.8 + hashUnit(`${id}:r`) * 0.38)
      const sn = pos.get(id)!
      sn.x = Math.cos(angle) * r
      sn.y = Math.sin(angle) * r
    })
  }

  return [...pos.values()]
}

function applyInitialPositions(sim: SimNode[], options?: GraphLayoutOptions): boolean {
  const initial = options?.initialPositions
  if (!initial?.size) return false
  let applied = 0
  for (const node of sim) {
    const seed = initial.get(node.id)
    if (!seed) continue
    node.x = seed.x
    node.y = seed.y
    node.vx = 0
    node.vy = 0
    if (options?.pinNodeIds?.has(node.id)) {
      node.pinned = true
    }
    applied += 1
  }
  return applied > 0
}

function resolveCollisions(
  sim: SimNode[],
  minDist: number,
  passes = 24,
  weights?: ReadonlyMap<string, number>,
  labelChars?: ReadonlyMap<string, number>,
): void {
  markLayoutPhysicsActivity('collision-resolve')
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!
        const b = sim[j]!
        const pairMinDist = pairMinNodeDistance(a.id, b.id, minDist, weights, labelChars)
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        if (dist < 1e-6) {
          const angle = ((i + j) * 0.618) % 1 * Math.PI * 2
          dx = Math.cos(angle) * 0.01
          dy = Math.sin(angle) * 0.01
          dist = 0.01
        }
        if (dist >= pairMinDist) continue
        const overlap = (pairMinDist - dist) / 2
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
  finalCollisionPasses = 32,
  isDense = false,
  weights?: ReadonlyMap<string, number>,
  labelChars?: ReadonlyMap<string, number>,
  layoutScope?: GraphLayoutScope,
): void {
  const idToSim = new Map(sim.map((n) => [n.id, n]))
  const largeGraph = sim.length >= LARGE_GRAPH_NODE_THRESHOLD
  const smallGraph = sim.length <= SMALL_GRAPH_BRANCH_LAYOUT_MAX && !isDense
  const isGlobal = layoutScope === 'global'
  const midCollisionPasses = isDense ? 7 : smallGraph ? 5 : largeGraph ? 2 : 4
  const springForce = isGlobal
    ? 0.036
    : isDense
      ? 0.048
      : smallGraph
        ? SMALL_GRAPH_SPRING_FORCE
        : LINK_SPRING_FORCE
  const repulseNear = isGlobal ? 0.74 : isDense ? 0.62 : smallGraph ? 0.4 : 0.55
  const repulseFar = isGlobal ? 0.5 : isDense ? 0.42 : smallGraph ? 0.26 : 0.35
  const repulseFarRange = isGlobal
    ? minDist * 3.4
    : isDense
      ? minDist * 2.8
      : minDist * 2.2

  for (let tick = 0; tick < iterations; tick++) {
    markLayoutPhysicsActivity('force-tick')
    for (const n of sim) {
      if (!n.pinned) {
        n.vx *= smallGraph ? 0.88 : 0.86
        n.vy *= smallGraph ? 0.88 : 0.86
      }
    }

    if (sim.length > SMALL_GRAPH_BRANCH_LAYOUT_MAX && tick < 12) {
      for (const n of sim) {
        if (n.pinned) continue
        n.vx += (hashUnit(n.id) - 0.5) * 0.06
        n.vy += (hashUnit(`${n.id}:vy`) - 0.5) * 0.06
      }
    } else if (smallGraph && tick < 18) {
      for (const n of sim) {
        if (n.pinned) continue
        n.vx += (hashUnit(`${n.id}:${tick}`) - 0.5) * 0.035
        n.vy += (hashUnit(`${n.id}:vy:${tick}`) - 0.5) * 0.035
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
        const pairMinDist = pairMinNodeDistance(a.id, b.id, minDist, weights, labelChars)
        if (dist < pairMinDist) {
          const force = ((pairMinDist - dist) / dist) * repulseNear
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
        } else if (dist < repulseFarRange) {
          const force = (pairMinDist * repulseFar) / distSq
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
      const hubBoost =
        1 +
        (Math.sqrt(layoutReferenceWeight(a.id, weights)) +
          Math.sqrt(layoutReferenceWeight(b.id, weights))) *
          0.035
      const force = delta * springForce * hubBoost
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
      resolveCollisions(sim, minDist, midCollisionPasses, weights, labelChars)
    }
  }

  resolveCollisions(sim, minDist, largeGraph ? 12 : finalCollisionPasses, weights, labelChars)
}

function findConnectedComponents(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
): string[][] {
  const parent = new Map<string, string>()
  for (const n of nodes) parent.set(n.id, n.id)

  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) {
      root = parent.get(root)!
    }
    let cur = id
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }

  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const e of edges) {
    if (parent.has(e.from) && parent.has(e.to)) {
      union(e.from, e.to)
    }
  }

  const groups = new Map<string, string[]>()
  for (const n of nodes) {
    const root = find(n.id)
    const list = groups.get(root) ?? []
    list.push(n.id)
    groups.set(root, list)
  }

  return [...groups.values()].sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
}

function computeSingleComponentLayout(
  nodes: GraphLayoutNodeInput[],
  edges: GraphLayoutEdgeInput[],
  options?: GraphLayoutOptions,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return out

  const adj = buildAdjacency(nodes, edges)
  const centerId = pickCenterId(nodes, edges, options?.centerNodeId, options?.nodeReferenceWeights)
  const densityProfile = analyzeGraphDensity(nodes, edges, centerId, adj, options)
  const { minDist, linkIdeal, iterations: baseIterations } = resolveLayoutScales(
    nodes.length,
    edges.length,
    options,
    densityProfile,
  )
  const iterationScale =
    densityProfile.isDense
      ? 1
      : nodes.length >= 240
        ? 0.35
        : nodes.length >= 180
          ? 0.5
          : nodes.length >= 120
            ? 0.7
            : 1
  const iterations = Math.max(24, Math.round(baseIterations * iterationScale))

  if (nodes.length === 1) {
    out.set(nodes[0]!.id, { x: 0, y: 0 })
    return out
  }

  const layoutScope = options?.layoutScope ?? 'local'
  const isGlobalLayout = layoutScope === 'global'
  const hasSeed = Boolean(options?.initialPositions?.size)
  const hasPinned = (options?.pinNodeIds?.size ?? 0) > 0
  const useBranchLayout = !hasSeed && shouldUseBranchLayout(nodes, adj, centerId, densityProfile)
  const useHubSectorLayout =
    !hasSeed &&
    !useBranchLayout &&
    shouldUseHubSectorLayout(nodes, adj, centerId, densityProfile, layoutScope)
  const hubDegree = adj.get(centerId)?.size ?? 0
  const isLargeHubStar =
    !isGlobalLayout &&
    useHubSectorLayout &&
    nodes.length > SMALL_GRAPH_BRANCH_LAYOUT_MAX &&
    hubDegree >= nodes.length - 2
  const sim = createInitialSimulation(
    nodes,
    edges,
    adj,
    centerId,
    linkIdeal,
    minDist,
    useBranchLayout,
    useHubSectorLayout,
    options?.nodeLabelChars,
    layoutScope,
  )
  applyInitialPositions(sim, options)
  const effectiveIterations = hasSeed && hasPinned
    ? Math.min(iterations, Math.max(24, Math.round(iterations * 0.45)))
    : hasSeed
      ? Math.min(iterations, Math.max(48, Math.round(iterations * 0.85)))
      : iterations
  const referenceWeights = options?.nodeReferenceWeights
  const labelChars = options?.nodeLabelChars
  if (hasSeed) {
    resolveCollisions(
      sim,
      minDist,
      nodes.length <= SMALL_GRAPH_BRANCH_LAYOUT_MAX ? 24 : 16,
      referenceWeights,
      labelChars,
    )
  }
  if (isLargeHubStar) {
    resolveCollisions(sim, minDist, 64, referenceWeights, labelChars)
  } else {
    const finalCollisionPasses = densityProfile.isDense
      ? 48
      : nodes.length <= SMALL_GRAPH_BRANCH_LAYOUT_MAX
        ? 40
        : nodes.length >= LARGE_GRAPH_NODE_THRESHOLD
          ? 12
          : 32
    runForceSimulation(
      sim,
      edges,
      minDist,
      linkIdeal,
      effectiveIterations,
      finalCollisionPasses,
      densityProfile.isDense,
      referenceWeights,
      labelChars,
      layoutScope,
    )
  }

  for (const n of sim) {
    out.set(n.id, { x: n.x, y: n.y })
  }
  if (isGlobalLayout && sim.length >= 8) {
    expandLayoutFromCentroid(out, 1 + Math.min(sim.length, 100) * 0.006)
  }
  return out
}

function expandLayoutFromCentroid(
  positions: Map<string, { x: number; y: number }>,
  scale: number,
): void {
  if (scale <= 1.001 || positions.size === 0) return
  let cx = 0
  let cy = 0
  for (const p of positions.values()) {
    cx += p.x
    cy += p.y
  }
  cx /= positions.size
  cy /= positions.size
  for (const p of positions.values()) {
    p.x = cx + (p.x - cx) * scale
    p.y = cy + (p.y - cy) * scale
  }
}

function packComponentLayouts(
  componentPositions: Array<Map<string, { x: number; y: number }>>,
  gap: number,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  if (componentPositions.length === 0) return out
  if (componentPositions.length === 1) {
    for (const [id, point] of componentPositions[0]!.entries()) {
      out.set(id, { ...point })
    }
    return out
  }

  type ComponentBox = {
    rootId: string
    minX: number
    minY: number
    width: number
    height: number
    positions: Map<string, { x: number; y: number }>
  }

  const boxes: ComponentBox[] = componentPositions.map((positions) => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let rootId = ''
    for (const [id, p] of positions) {
      if (!rootId || id < rootId) rootId = id
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    return {
      rootId,
      minX,
      minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
      positions,
    }
  })

  boxes.sort(
    (a, b) => b.width * b.height - a.width * a.height || a.rootId.localeCompare(b.rootId),
  )

  const maxExtent = boxes.reduce((max, box) => Math.max(max, box.width, box.height), 0)
  const separationMargin = 20
  if (maxExtent > gap * 32) {
    let cursorX = 0
    for (const box of boxes) {
      const shiftX = cursorX - box.minX
      const centerY = box.minY + box.height / 2
      for (const [id, point] of box.positions) {
        out.set(id, { x: point.x + shiftX, y: point.y - centerY })
      }
      cursorX += box.width + gap + separationMargin
    }
    return out
  }

  type Placed = { cx: number; cy: number; halfW: number; halfH: number }
  const placed: Placed[] = []
  const packStep = gap * 0.92

  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index]!
    const compCx = box.minX + box.width / 2
    const compCy = box.minY + box.height / 2
    const halfW = box.width / 2 + gap * 0.35
    const halfH = box.height / 2 + gap * 0.35
    const rot = (hashUnit(box.rootId) - 0.5) * 0.52

    let cx = 0
    let cy = 0
    if (index > 0) {
      const t = index + hashUnit(`pack:${box.rootId}`) * 0.65
      const spiralR = packStep * Math.sqrt(t) * 1.35
      const angle = t * GOLDEN_ANGLE + hashUnit(box.rootId) * 1.1
      cx = Math.cos(angle) * spiralR
      cy = Math.sin(angle) * spiralR

      for (let pass = 0; pass < 14; pass += 1) {
        for (const prev of placed) {
          const dx = cx - prev.cx
          const dy = cy - prev.cy
          const overlapX = halfW + prev.halfW - Math.abs(dx)
          const overlapY = halfH + prev.halfH - Math.abs(dy)
          if (overlapX > 0 && overlapY > 0) {
            const push = Math.min(overlapX, overlapY) * 0.62 + 3
            const dist = Math.hypot(dx, dy) || 1
            cx += (dx / dist) * push
            cy += (dy / dist) * push
          }
        }
      }
    }

    placed.push({ cx, cy, halfW, halfH })

    for (const [id, point] of box.positions) {
      const local = rotatePoint(point.x - compCx, point.y - compCy, rot)
      out.set(id, { x: cx + local.x, y: cy + local.y })
    }
  }

  return out
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
  if (nodes.length === 0) return new Map()

  const linkIdeal = options?.linkIdealLength ?? DEFAULT_LINK
  const components = findConnectedComponents(nodes, edges)

  if (components.length <= 1) {
    return computeSingleComponentLayout(nodes, edges, options)
  }

  const componentLayouts = components.map((ids) => {
    const idSet = new Set(ids)
    const compNodes = nodes.filter((n) => idSet.has(n.id))
    const compEdges = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to))
    const preferredCenter =
      options?.centerNodeId && idSet.has(options.centerNodeId) ? options.centerNodeId : null
    return computeSingleComponentLayout(compNodes, compEdges, {
      ...options,
      centerNodeId: preferredCenter,
    })
  })

  return packComponentLayouts(
    componentLayouts,
    linkIdeal * (options?.layoutScope === 'global' ? 2.2 : 1.5),
  )
}

export { findConnectedComponents }

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
