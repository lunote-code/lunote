import {
  canonicalizeWikiLinkText,
  getGraphViewState,
  getIncomingEdges,
  getOutgoingLinkRefs,
  getOutgoingEdges,
  getGraphSnapshot,
  getDocumentMeta,
  refreshGraphViewIncremental,
  subscribeGraphView,
} from '../knowledgeRuntime'
import { wikiLinkInnerTargetText } from '../knowledgeRuntime/wikiLinkParser'
import type { DocKey } from '../knowledgeRuntime/types'
import {
  getGraphViewport,
  resetGraphViewportRuntime,
} from './graphViewportRuntime'
import {
  beginGraphUpdate,
  endGraphUpdate,
  resetGraphInteractionGuard,
  safeGraphUpdate,
} from './graphInteractionGuard'
import { computeGraphLayout, computeGridLayoutFallback } from './layout/computeGraphLayout'
import { notifyGraphLayoutComplete } from './graphCameraLock'
import { notifyGraphTopologyReady } from './graphReadinessRuntime'
import {
  markLayoutPhysicsActivity,
  markLayoutPhysicsIfNodePositionsChanged,
} from './graphLayoutPhysicsHeartbeat'
import {
  beginGraphLayoutTask,
  clearGraphEdgeRecomputeScheduled,
  endGraphLayoutTask,
  markGraphEdgeRecomputeScheduled,
  setGraphLazyLayoutPending,
} from './graphLayoutDependencyRuntime'
import { isKnowledgeOSBooting, shouldDeferGraphForceLayout } from './knowledgeOSBoot'
import { recordGraphLayoutRecompute } from './layout/graphViewportProfile'
import {
  DEFAULT_NOTE_GRAPH_DEPTH,
  getNoteGraphDepthPreference,
  normalizeNoteGraphDepth,
} from './graphDepthPreference'
import {
  getNoteGraphFilterPreference,
  type NoteGraphFilterPreference,
} from './graphFilterPreference'
import type { NoteGraphEdge, NoteGraphLimit, NoteGraphNode, NoteGraphSnapshot } from './types'

export const NOTE_GRAPH_MAX_NODES = 120
export const NOTE_GRAPH_MAX_EDGES = 200

type NoteGraphTopology = Omit<NoteGraphSnapshot, 'viewport'>

function buildGraphLimit(shownNodes: number, shownEdges: number, capped: boolean): NoteGraphLimit | null {
  if (!capped) return null
  return {
    shownNodes,
    shownEdges,
    maxNodes: NOTE_GRAPH_MAX_NODES,
    maxEdges: NOTE_GRAPH_MAX_EDGES,
  }
}

const DEFAULT_DEPTH = DEFAULT_NOTE_GRAPH_DEPTH

let topologyRootDocKey: DocKey | null = null
let depth = DEFAULT_DEPTH
let graphDataRevision = 0

function bumpGraphLayoutRevision(): void {
  markLayoutPhysicsActivity('layout-complete')
  graphDataRevision += 1
  notifyGraphLayoutComplete(graphDataRevision)
}
let graphInteracting = false
let snapshotReadDepth = 0
let lazyLayoutScheduled = false
let cachedSubgraph: {
  center: DocKey
  depth: number
  filterKey: string
  nodes: NoteGraphNode[]
  edges: NoteGraphEdge[]
  layoutKind: 'fallback' | 'force'
  graphLimit: NoteGraphLimit | null
} | null = null

let lastTopology: NoteGraphTopology = {
  centerDocKey: null,
  depth: DEFAULT_DEPTH,
  nodes: [],
  edges: [],
  revision: 0,
  graphLimit: null,
}

const listeners = new Set<() => void>()

export function isGraphInteracting(): boolean {
  return graphInteracting
}

export function setGraphInteracting(active: boolean): void {
  graphInteracting = active
}

type TopologyNode = {
  id: string
  docKey: DocKey
  label: string
  heading?: string
  status: 'resolved' | 'unresolved'
  navigable: boolean
}

function nodeDocKeyFromId(nodeId: string): DocKey {
  return nodeId.replace(/^page:/u, '')
}

function graphNodeDisplayLabel(
  docKey: DocKey,
  status: 'resolved' | 'unresolved',
  graphNode?: { label?: string; raw?: string },
): string {
  const pick = (value?: string): string | undefined => {
    const t = value?.trim()
    if (!t) return undefined
    if (t.startsWith('unresolved:')) return undefined
    const inner = wikiLinkInnerTargetText(t, '')
    return inner || undefined
  }
  if (status === 'unresolved') {
    return (
      pick(graphNode?.label) ??
      pick(graphNode?.raw) ??
      (docKey.startsWith('unresolved:')
        ? docKey.slice('unresolved:'.length) || docKey
        : docKey.split('/').pop() ?? docKey)
    )
  }
  return pick(graphNode?.label) ?? pick(graphNode?.raw) ?? docKey.split('/').pop() ?? docKey
}

function graphFilterKey(filters: NoteGraphFilterPreference): string {
  return `${filters.showUnresolved ? 'u1' : 'u0'}:${filters.showHeadingNodes ? 'h1' : 'h0'}:${filters.edgeDirection}`
}

function collectLocalSubgraph(
  root: DocKey,
  maxDepth: number,
  filters: NoteGraphFilterPreference,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[]; limitReached: boolean } {
  const graphNodeById = new Map(getGraphSnapshot().nodes.map((n) => [n.id, n]))
  const nodeMap = new Map<string, TopologyNode>()
  const edges: NoteGraphEdge[] = []
  const edgeSeen = new Set<string>()
  const edgePairSeen = new Set<string>()
  let limitReached = false

  const tryAddEdge = (
    edgeId: string,
    from: string,
    to: string,
    kind: NoteGraphEdge['kind'],
  ): void => {
    if (limitReached || edges.length >= NOTE_GRAPH_MAX_EDGES) {
      limitReached = true
      return
    }
    const pairKey = `${from}\0${to}`
    if (edgePairSeen.has(pairKey) || edgeSeen.has(edgeId)) return
    edgePairSeen.add(pairKey)
    edgeSeen.add(edgeId)
    edges.push({ id: edgeId, from, to, kind })
  }

  const addNode = (
    id: string,
    docKey: DocKey,
    status: 'resolved' | 'unresolved',
    label = docKey.split('/').pop() ?? docKey,
    heading?: string,
  ) => {
    if (limitReached || nodeMap.size >= NOTE_GRAPH_MAX_NODES) {
      limitReached = true
      return
    }
    if (nodeMap.has(id)) return
    nodeMap.set(id, {
      id,
      docKey,
      label,
      heading,
      status,
      navigable: status === 'resolved',
    })
  }

  const includeOutgoing = filters.edgeDirection === 'all' || filters.edgeDirection === 'outgoing'
  const includeIncoming = filters.edgeDirection === 'all' || filters.edgeDirection === 'incoming'

  const visitExpanded = new Set<string>()

  const visit = (key: DocKey, d: number) => {
    if (limitReached) return
    const pageId = `page:${key}`
    if (d > maxDepth) return
    if (!getDocumentMeta(key)) return
    const visitKey = `${pageId}@${d}`
    if (visitExpanded.has(visitKey)) return
    visitExpanded.add(visitKey)
    if (!nodeMap.has(pageId)) addNode(pageId, key, 'resolved')
    if (includeOutgoing) {
      for (const e of getOutgoingEdges(key)) {
        const target = e.targetDocKey ?? nodeDocKeyFromId(e.to)
        let targetStatus = e.targetStatus ?? 'resolved'
        if (targetStatus === 'resolved' && !getDocumentMeta(target)) {
          targetStatus = 'unresolved'
        }
        if (d + 1 > maxDepth) continue
        if (targetStatus === 'unresolved' && !filters.showUnresolved) continue
        const targetId = e.to
        const displayLabel = graphNodeDisplayLabel(target, targetStatus, graphNodeById.get(targetId))
        addNode(targetId, target, targetStatus, displayLabel)
        tryAddEdge(
          `out:${key}:${target}`,
          `page:${key}`,
          targetId,
          e.kind === 'embed' ? 'embed' : 'link',
        )
        if (targetStatus === 'resolved' && d + 1 < maxDepth) visit(target, d + 1)
      }
    }
    //The heading links in the same document are visualized as separate nodes to avoid leaving only unresolved nodes in the subgraph.
    if (filters.showHeadingNodes && includeOutgoing) {
      for (const ref of getOutgoingLinkRefs(key)) {
        if (ref.target.status !== 'resolved') continue
        if (ref.target.docKey !== key) continue
        const headingLabel = ref.heading ?? ref.target.label ?? ref.target.canonical
        if (!headingLabel) continue
        const headingSlug = canonicalizeWikiLinkText(headingLabel)
        if (!headingSlug) continue
        const headingId = `heading:${key}:${headingSlug}`
        addNode(headingId, key, 'resolved', headingLabel, headingLabel)
        tryAddEdge(
          `out-heading:${key}:${headingId}`,
          `page:${key}`,
          headingId,
          ref.kind === 'embed' ? 'embed' : 'link',
        )
      }
    }
    if (includeIncoming) {
      for (const e of getIncomingEdges(key)) {
        const source = e.sourceDocKey as DocKey
        if (!getDocumentMeta(source)) continue
        if (d + 1 > maxDepth) continue
        addNode(`page:${source}`, source, 'resolved')
        tryAddEdge(
          `in:${source}:${key}`,
          `page:${source}`,
          `page:${key}`,
          e.kind === 'embed' ? 'embed' : 'link',
        )
        if (d + 1 < maxDepth) visit(source, d + 1)
      }
    }
  }

  visit(root, 0)

  return { nodes: [...nodeMap.values()], edges, limitReached }
}

function positionsToNodes(
  topoNodes: TopologyNode[],
  positions: Map<string, { x: number; y: number }>,
  prevNodes?: readonly NoteGraphNode[],
): NoteGraphNode[] {
  const next = topoNodes.map((n) => {
    const p = positions.get(n.id) ?? { x: 0, y: 0 }
    return { ...n, x: p.x, y: p.y }
  })
  if (prevNodes && prevNodes.length > 0) {
    markLayoutPhysicsIfNodePositionsChanged(prevNodes, next)
  } else {
    markLayoutPhysicsActivity('node-position')
  }
  return next
}

function applyForceLayout(
  topoNodes: TopologyNode[],
  edges: NoteGraphEdge[],
  centerDocKey: DocKey | null,
  prevNodes?: readonly NoteGraphNode[],
): NoteGraphNode[] {
  markLayoutPhysicsActivity('force-layout')
  const centerNodeId = centerDocKey ? `page:${centerDocKey}` : null
  const positions = computeGraphLayout(
    topoNodes.map((n) => ({ id: n.id })),
    edges.map((e) => ({ from: e.from, to: e.to })),
    { centerNodeId },
  )
  return positionsToNodes(topoNodes, positions, prevNodes)
}

function applyFallbackLayout(
  topoNodes: TopologyNode[],
  prevNodes?: readonly NoteGraphNode[],
): NoteGraphNode[] {
  const positions = computeGridLayoutFallback(topoNodes.map((n) => ({ id: n.id })))
  return positionsToNodes(topoNodes, positions, prevNodes)
}

function runDeferredForceLayout(): void {
  lazyLayoutScheduled = false
  setGraphLazyLayoutPending(false)
  if (shouldDeferGraphForceLayout() || !topologyRootDocKey || !cachedSubgraph) {
    if (topologyRootDocKey && cachedSubgraph?.layoutKind === 'fallback') {
      scheduleLazyGraphLayout()
    }
    return
  }
  if (cachedSubgraph.layoutKind === 'force') return
  if (
    cachedSubgraph.center !== topologyRootDocKey ||
    cachedSubgraph.depth !== depth ||
    cachedSubgraph.filterKey !== graphFilterKey(getNoteGraphFilterPreference())
  ) {
    return
  }

  if (!beginGraphUpdate()) {
    scheduleLazyGraphLayout()
    return
  }

  try {
    recordGraphLayoutRecompute('computeGraphLayout')
    const filters = getNoteGraphFilterPreference()
    const topo = collectLocalSubgraph(topologyRootDocKey, depth, filters)
    const nodes = applyForceLayout(
      topo.nodes,
      topo.edges,
      topologyRootDocKey,
      cachedSubgraph.nodes,
    )
    const graphLimit = buildGraphLimit(nodes.length, topo.edges.length, topo.limitReached)
    cachedSubgraph = {
      center: topologyRootDocKey,
      depth,
      filterKey: graphFilterKey(filters),
      nodes,
      edges: topo.edges,
      layoutKind: 'force',
      graphLimit,
    }
    bumpGraphLayoutRevision()
    rebuildSnapshot()
    notifyGraphTopologyReady()
  } finally {
    endGraphUpdate()
  }
}

function scheduleLazyGraphLayout(): void {
  if (lazyLayoutScheduled) return
  markLayoutPhysicsActivity('layout-scheduled')
  lazyLayoutScheduled = true
  setGraphLazyLayoutPending(true)
  beginGraphLayoutTask()

  const run = (): void => {
    lazyLayoutScheduled = false
    try {
      runDeferredForceLayout()
    } finally {
      endGraphLayoutTask()
    }
  }

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 800 })
  } else {
    setTimeout(run, 0)
  }
}

function buildSubgraphWithLayout(
  center: DocKey,
  subgraphDepth: number,
): { nodes: NoteGraphNode[]; edges: NoteGraphEdge[]; graphLimit: NoteGraphLimit | null } {
  markGraphEdgeRecomputeScheduled()
  const filters = getNoteGraphFilterPreference()
  const filterKey = graphFilterKey(filters)
  const topo = collectLocalSubgraph(center, subgraphDepth, filters)
  const useFallback = isKnowledgeOSBooting()
  const prevNodes =
    cachedSubgraph?.center === center &&
    cachedSubgraph.depth === subgraphDepth &&
    cachedSubgraph.filterKey === filterKey
      ? cachedSubgraph.nodes
      : undefined
  const nodes = useFallback
    ? applyFallbackLayout(topo.nodes, prevNodes)
    : applyForceLayout(topo.nodes, topo.edges, center, prevNodes)

  const graphLimit = buildGraphLimit(nodes.length, topo.edges.length, topo.limitReached)

  cachedSubgraph = {
    center,
    depth: subgraphDepth,
    filterKey,
    nodes,
    edges: topo.edges,
    layoutKind: useFallback ? 'fallback' : 'force',
    graphLimit,
  }

  if (useFallback || cachedSubgraph.layoutKind === 'fallback') {
    scheduleLazyGraphLayout()
  }

  bumpGraphLayoutRevision()
  clearGraphEdgeRecomputeScheduled()

  return { nodes, edges: topo.edges, graphLimit }
}

function getCachedSubgraph(): {
  nodes: NoteGraphNode[]
  edges: NoteGraphEdge[]
  graphLimit: NoteGraphLimit | null
} {
  if (!topologyRootDocKey) return { nodes: [], edges: [], graphLimit: null }
  if (
    cachedSubgraph &&
    cachedSubgraph.center === topologyRootDocKey &&
    cachedSubgraph.depth === depth &&
    cachedSubgraph.filterKey === graphFilterKey(getNoteGraphFilterPreference())
  ) {
    return {
      nodes: cachedSubgraph.nodes,
      edges: cachedSubgraph.edges,
      graphLimit: cachedSubgraph.graphLimit,
    }
  }
  return buildSubgraphWithLayout(topologyRootDocKey, depth)
}

function invalidateGraphDataCache(): void {
  cachedSubgraph = null
  bumpGraphLayoutRevision()
}

/** Drop cached subgraph after link graph / registry mutations (e.g. deleted target file). */
export function invalidateNoteGraphSubgraphCache(): void {
  invalidateGraphDataCache()
}

function rebuildSnapshot(): void {
  safeGraphUpdate(() => {
    listeners.forEach((fn) => fn())
  })
}

/**
 * The topology root is synchronized by route; only grid fallback + asynchronous force layout is used in the startup phase.
 */
export function syncNoteGraphTopologyFromRoute(docKey: DocKey | null, options?: { depth?: number }): void {
  const prev = topologyRootDocKey
  const filters = getNoteGraphFilterPreference()
  const filterKey = graphFilterKey(filters)
  const nextDepth = normalizeNoteGraphDepth(options?.depth ?? getNoteGraphDepthPreference())
  const depthChanged = nextDepth !== depth
  const filtersChanged = cachedSubgraph?.filterKey !== filterKey
  if (docKey === prev && !depthChanged && !filtersChanged) return

  topologyRootDocKey = docKey
  depth = nextDepth
  invalidateGraphDataCache()

  const ownsGraph = beginGraphUpdate()
  try {
    if (!docKey) {
      if (!isKnowledgeOSBooting()) {
        refreshGraphViewIncremental()
      }
      rebuildSnapshot()
      return
    }

    if (docKey !== prev && !isKnowledgeOSBooting()) {
      refreshGraphViewIncremental()
    }

    if (
      !cachedSubgraph ||
      cachedSubgraph.center !== docKey ||
      cachedSubgraph.depth !== depth ||
      cachedSubgraph.filterKey !== filterKey
    ) {
      buildSubgraphWithLayout(docKey, depth)
    }

    rebuildSnapshot()
    notifyGraphTopologyReady()
  } finally {
    if (ownsGraph) {
      endGraphUpdate()
    } else {
      queueMicrotask(() => {
        rebuildSnapshot()
        notifyGraphTopologyReady()
      })
    }
  }
}

function docKeyFromNodeId(nodeId: string): DocKey | null {
  const key = nodeId.replace(/^page:/u, '')
  return key || null
}

/**
 * If node is not in the current subgraph, use the node docKey as the root to expand and incrementally recalculate the layout.
 */
export function ensureNodeInRenderedSubgraph(nodeId: string): boolean {
  const docKey = docKeyFromNodeId(nodeId)
  if (!docKey) return false

  if (cachedSubgraph?.nodes.some((n) => n.id === nodeId)) {
    return true
  }

  const ownsGraph = beginGraphUpdate()
  try {
    topologyRootDocKey = docKey
    invalidateGraphDataCache()
    buildSubgraphWithLayout(docKey, depth)
    rebuildSnapshot()
    notifyGraphTopologyReady()
  } finally {
    if (ownsGraph) endGraphUpdate()
  }

  return cachedSubgraph?.nodes.some((n) => n.id === nodeId) ?? false
}

/** Parse the node corresponding to the route; if there is no match, fallback to the first visible node.*/
export function resolveRouteCenterNode(
  nodes: readonly NoteGraphNode[],
  routeDocKey: DocKey | null,
): NoteGraphNode | null {
  if (nodes.length === 0) return null
  if (routeDocKey) {
    const match = nodes.find((n) => n.docKey === routeDocKey)
    if (match) return match
  }
  return nodes[0] ?? null
}

export function flushDeferredGraphLayout(): void {
  if (shouldDeferGraphForceLayout()) return
  if (cachedSubgraph?.layoutKind === 'fallback') {
    runDeferredForceLayout()
  }
}

export function getNoteGraphTopology(): Readonly<NoteGraphTopology> {
  if (snapshotReadDepth > 2) {
    return lastTopology
  }

  snapshotReadDepth += 1
  try {
    if (!topologyRootDocKey) {
      const global = getGraphViewState()
      const allNodes = global.nodes.filter(
        (n) => (n.kind === 'page' || n.kind === 'unresolved') && n.docKey,
      )
      const topoNodes: TopologyNode[] = allNodes.slice(0, NOTE_GRAPH_MAX_NODES).map((n) => ({
        id: n.id,
        docKey: n.docKey!,
        label: n.label,
        status: n.status ?? (n.kind === 'unresolved' ? 'unresolved' : 'resolved'),
        navigable: (n.status ?? (n.kind === 'unresolved' ? 'unresolved' : 'resolved')) === 'resolved',
      }))
      const globalEdges = global.edges.slice(0, NOTE_GRAPH_MAX_EDGES).map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        kind: e.kind === 'embed' ? ('embed' as const) : ('link' as const),
      }))
      const layoutNodes = shouldDeferGraphForceLayout()
        ? applyFallbackLayout(topoNodes)
        : applyForceLayout(topoNodes, globalEdges, null)
      const graphLimit = buildGraphLimit(
        layoutNodes.length,
        globalEdges.length,
        allNodes.length > topoNodes.length || global.edges.length > globalEdges.length,
      )
      lastTopology = {
        centerDocKey: null,
        depth,
        nodes: layoutNodes,
        edges: globalEdges,
        revision: graphDataRevision,
        graphLimit,
      }
      return lastTopology
    }

    const cached =
      graphInteracting && cachedSubgraph
        ? {
            nodes: cachedSubgraph.nodes,
            edges: cachedSubgraph.edges,
            graphLimit: cachedSubgraph.graphLimit,
          }
        : getCachedSubgraph()

    lastTopology = {
      centerDocKey: topologyRootDocKey,
      depth,
      nodes: cached.nodes,
      edges: cached.edges,
      revision: graphDataRevision,
      graphLimit: cached.graphLimit,
    }
    return lastTopology
  } finally {
    snapshotReadDepth -= 1
  }
}

export function getNoteGraphSnapshot(): NoteGraphSnapshot {
  const topology = getNoteGraphTopology()
  return {
    ...topology,
    viewport: getGraphViewport(),
  }
}

export function getVisibleGraphNodes(
  width: number,
  height: number,
  padding = 64,
): NoteGraphNode[] {
  const topo = getNoteGraphTopology()
  const { x, y, zoom } = getGraphViewport()
  const minX = (-x - padding) / zoom
  const minY = (-y - padding) / zoom
  const maxX = (width - x + padding) / zoom
  const maxY = (height - y + padding) / zoom
  return topo.nodes.filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
}

export function subscribeNoteGraph(listener: () => void): () => void {
  listeners.add(listener)
  const unsubGlobal = subscribeGraphView(() => {
    if (!topologyRootDocKey || isKnowledgeOSBooting()) return
    invalidateGraphDataCache()
    rebuildSnapshot()
  })
  return () => {
    listeners.delete(listener)
    unsubGlobal()
  }
}

export function resetNoteGraphRuntime(): void {
  topologyRootDocKey = null
  depth = DEFAULT_DEPTH
  graphDataRevision = 0
  graphInteracting = false
  snapshotReadDepth = 0
  lazyLayoutScheduled = false
  setGraphLazyLayoutPending(false)
  cachedSubgraph = null
  listeners.clear()
  lastTopology = {
    centerDocKey: null,
    depth: DEFAULT_DEPTH,
    nodes: [],
    edges: [],
    revision: 0,
    graphLimit: null,
  }
  resetGraphViewportRuntime()
  resetGraphInteractionGuard()
}
