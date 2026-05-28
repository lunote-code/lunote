import {
  canonicalizeWikiLinkText,
  getGraphViewState,
  getIncomingEdges,
  getOutgoingLinkRefs,
  getOutgoingEdges,
  getGraphSnapshot,
  getDocumentMeta,
  refreshGraphViewIncremental,
  setGraphViewport,
  subscribeGraphView,
} from '../knowledgeRuntime'
import { wikiLinkInnerTargetText } from '../knowledgeRuntime/wikiLinkParser'
import type { DocKey } from '../knowledgeRuntime/types'
import {
  getGraphViewport,
  resetGraphViewportRuntime,
  setGraphViewportIntent,
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
import type { NoteGraphEdge, NoteGraphNode, NoteGraphSnapshot } from './types'

const DEFAULT_DEPTH = 2

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
  nodes: NoteGraphNode[]
  edges: NoteGraphEdge[]
  layoutKind: 'fallback' | 'force'
} | null = null
const loggedGraphRuntimeNodeKeys = new Set<string>()

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

type NoteGraphTopology = Omit<NoteGraphSnapshot, 'viewport'>

let lastTopology: NoteGraphTopology = {
  centerDocKey: null,
  depth: DEFAULT_DEPTH,
  nodes: [],
  edges: [],
  revision: 0,
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

function collectLocalSubgraph(
  root: DocKey,
  maxDepth: number,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[] } {
  const graphNodeById = new Map(getGraphSnapshot().nodes.map((n) => [n.id, n]))
  const nodeMap = new Map<string, TopologyNode>()
  const edges: NoteGraphEdge[] = []
  const edgeSeen = new Set<string>()

  const addNode = (
    id: string,
    docKey: DocKey,
    status: 'resolved' | 'unresolved',
    label = docKey.split('/').pop() ?? docKey,
    heading?: string,
  ) => {
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

  const visit = (key: DocKey, d: number) => {
    const pageId = `page:${key}`
    if (nodeMap.has(pageId) || d > maxDepth) return
    if (!getDocumentMeta(key)) return
    addNode(pageId, key, 'resolved')
    for (const e of getOutgoingEdges(key)) {
      const target = e.targetDocKey ?? nodeDocKeyFromId(e.to)
      const targetStatus = e.targetStatus ?? 'resolved'
      if (targetStatus === 'resolved' && !getDocumentMeta(target)) continue
      const targetId = e.to
      const displayLabel = graphNodeDisplayLabel(target, targetStatus, graphNodeById.get(targetId))
      addNode(targetId, target, targetStatus, displayLabel)
      const edgeId = `out:${key}:${target}`
      if (!edgeSeen.has(edgeId)) {
        edgeSeen.add(edgeId)
        edges.push({
          id: edgeId,
          from: `page:${key}`,
          to: targetId,
          kind: e.kind === 'embed' ? 'embed' : 'link',
        })
      }
      if (targetStatus === 'resolved' && d < maxDepth) visit(target, d + 1)
    }
    //The heading links in the same document are visualized as separate nodes to avoid leaving only unresolved nodes in the subgraph.
    for (const ref of getOutgoingLinkRefs(key)) {
      if (ref.target.status !== 'resolved') continue
      if (ref.target.docKey !== key) continue
      const headingLabel = ref.heading ?? ref.target.label ?? ref.target.canonical
      if (!headingLabel) continue
      const headingSlug = canonicalizeWikiLinkText(headingLabel)
      if (!headingSlug) continue
      const headingId = `heading:${key}:${headingSlug}`
      addNode(headingId, key, 'resolved', headingLabel, headingLabel)
      const edgeId = `out-heading:${key}:${headingId}`
      if (!edgeSeen.has(edgeId)) {
        edgeSeen.add(edgeId)
        edges.push({
          id: edgeId,
          from: `page:${key}`,
          to: headingId,
          kind: ref.kind === 'embed' ? 'embed' : 'link',
        })
      }
    }
    for (const e of getIncomingEdges(key)) {
      const source = e.sourceDocKey as DocKey
      if (!getDocumentMeta(source)) continue
      addNode(`page:${source}`, source, 'resolved')
      const edgeId = `in:${source}:${key}`
      if (!edgeSeen.has(edgeId)) {
        edgeSeen.add(edgeId)
        edges.push({
          id: edgeId,
          from: `page:${source}`,
          to: `page:${key}`,
          kind: e.kind === 'embed' ? 'embed' : 'link',
        })
      }
      if (d < maxDepth) visit(source, d + 1)
    }
  }

  visit(root, 0)

  return { nodes: [...nodeMap.values()], edges }
}

function positionsToNodes(
  topoNodes: TopologyNode[],
  positions: Map<string, { x: number; y: number }>,
  prevNodes?: readonly NoteGraphNode[],
): NoteGraphNode[] {
  const next = topoNodes.map((n) => {
    const p = positions.get(n.id) ?? { x: 0, y: 0 }
    const node = { ...n, x: p.x, y: p.y }
    const logKey = `${n.id}:${n.docKey}:${n.label}`
    if (!loggedGraphRuntimeNodeKeys.has(logKey)) {
      loggedGraphRuntimeNodeKeys.add(logKey)
      if (isAgentLogEnabled()) {
        // #region agent log
        console.debug('[graph-runtime-node]', { nodeId: n.id, docKey: n.docKey, title: n.label })
        // #endregion
      }
    }
    return node
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
    cachedSubgraph.depth !== depth
  ) {
    return
  }

  if (!beginGraphUpdate()) {
    scheduleLazyGraphLayout()
    return
  }

  try {
    recordGraphLayoutRecompute('computeGraphLayout')
    const topo = collectLocalSubgraph(topologyRootDocKey, depth)
    const nodes = applyForceLayout(
      topo.nodes,
      topo.edges,
      topologyRootDocKey,
      cachedSubgraph.nodes,
    )
    cachedSubgraph = {
      center: topologyRootDocKey,
      depth,
      nodes,
      edges: topo.edges,
      layoutKind: 'force',
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
): { nodes: NoteGraphNode[]; edges: NoteGraphEdge[] } {
  markGraphEdgeRecomputeScheduled()
  const topo = collectLocalSubgraph(center, subgraphDepth)
  const useFallback = isKnowledgeOSBooting()
  const prevNodes =
    cachedSubgraph?.center === center && cachedSubgraph.depth === subgraphDepth
      ? cachedSubgraph.nodes
      : undefined
  const nodes = useFallback
    ? applyFallbackLayout(topo.nodes, prevNodes)
    : applyForceLayout(topo.nodes, topo.edges, center, prevNodes)

  cachedSubgraph = {
    center,
    depth: subgraphDepth,
    nodes,
    edges: topo.edges,
    layoutKind: useFallback ? 'fallback' : 'force',
  }

  if (useFallback || cachedSubgraph.layoutKind === 'fallback') {
    scheduleLazyGraphLayout()
  }

  bumpGraphLayoutRevision()
  clearGraphEdgeRecomputeScheduled()
  if (isAgentLogEnabled()) {
    // #region agent log
    console.debug('[graph-runtime-rebuild]', { center, depth: subgraphDepth, nodeCount: nodes.length, edgeCount: topo.edges.length })
    console.debug('[graph-runtime-node-count]', { center, nodeCount: nodes.length, edgeCount: topo.edges.length })
    // #endregion
  }

  return { nodes, edges: topo.edges }
}

function getCachedSubgraph(): { nodes: NoteGraphNode[]; edges: NoteGraphEdge[] } {
  if (!topologyRootDocKey) return { nodes: [], edges: [] }
  if (
    cachedSubgraph &&
    cachedSubgraph.center === topologyRootDocKey &&
    cachedSubgraph.depth === depth
  ) {
    return { nodes: cachedSubgraph.nodes, edges: cachedSubgraph.edges }
  }
  return buildSubgraphWithLayout(topologyRootDocKey, depth)
}

function invalidateGraphDataCache(): void {
  cachedSubgraph = null
  bumpGraphLayoutRevision()
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
  const depthChanged = options?.depth != null && options.depth !== depth
  if (docKey === prev && !depthChanged) return

  topologyRootDocKey = docKey
  if (options?.depth != null) depth = options.depth
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

    if (!cachedSubgraph || cachedSubgraph.center !== docKey || cachedSubgraph.depth !== depth) {
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

/** @deprecated using syncNoteGraphTopologyFromRoute*/
export function setNoteGraphCenter(docKey: DocKey | null, options?: { depth?: number }): void {
  syncNoteGraphTopologyFromRoute(docKey, options)
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
      const topoNodes: TopologyNode[] = global.nodes
        .filter((n) => (n.kind === 'page' || n.kind === 'unresolved') && n.docKey)
        .slice(0, 120)
        .map((n) => ({
          id: n.id,
          docKey: n.docKey!,
          label: n.label,
          status: n.status ?? (n.kind === 'unresolved' ? 'unresolved' : 'resolved'),
          navigable: (n.status ?? (n.kind === 'unresolved' ? 'unresolved' : 'resolved')) === 'resolved',
        }))
      const globalEdges = global.edges.slice(0, 200).map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        kind: e.kind === 'embed' ? ('embed' as const) : ('link' as const),
      }))
      const layoutNodes = shouldDeferGraphForceLayout()
        ? applyFallbackLayout(topoNodes)
        : applyForceLayout(topoNodes, globalEdges, null)
      lastTopology = {
        centerDocKey: null,
        depth,
        nodes: layoutNodes,
        edges: globalEdges,
        revision: graphDataRevision,
      }
      return lastTopology
    }

    const { nodes, edges } =
      graphInteracting && cachedSubgraph
        ? { nodes: cachedSubgraph.nodes, edges: cachedSubgraph.edges }
        : getCachedSubgraph()

    lastTopology = {
      centerDocKey: topologyRootDocKey,
      depth,
      nodes,
      edges,
      revision: graphDataRevision,
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

/** @deprecated use setGraphViewportIntent*/
export function setNoteGraphViewport(vp: { x: number; y: number; zoom: number }): void {
  setGraphViewportIntent({ kind: 'set', viewport: vp })
  setGraphViewport(vp)
  rebuildSnapshot()
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
  }
  loggedGraphRuntimeNodeKeys.clear()
  if (isAgentLogEnabled()) {
    // #region agent log
    console.debug('[graph-runtime-reset]', { nodeCount: 0, edgeCount: 0 })
    // #endregion
  }
  resetGraphViewportRuntime()
  resetGraphInteractionGuard()
}
