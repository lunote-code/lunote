import {
  canonicalizeWikiLinkText,
  getGraphViewState,
  getIncomingEdges,
  getOutgoingLinkRefs,
  getOutgoingEdges,
  getGraphSnapshot,
  getDocumentMeta,
  getIncomingLinkRefs,
  listDocumentMetas,
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
import { buildGraphNodeReferenceCounts } from './graphNodeReferenceWeight'
import { computeGraphLayout, computeGridLayoutFallback, type GraphLayoutOptions, type GraphLayoutScope } from './layout/computeGraphLayout'
import { notifyGraphLayoutComplete } from './graphCameraLock'
import { notifyGraphTopologyReady } from './graphReadinessRuntime'
import {
  markLayoutPhysicsActivity,
  markLayoutPhysicsIfNodePositionsChanged,
} from './graphLayoutPhysicsHeartbeat'
import {
  applyGraphNodePositionOverrides,
  clearGraphNodePositionOverrides,
  getGraphNodePositionOverride,
  setGraphNodePositionOverride,
} from './graphNodePositionRuntime'
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
  setNoteGraphDepthPreference,
  MAX_NOTE_GRAPH_DEPTH,
} from './graphDepthPreference'
import {
  getNoteGraphFilterPreference,
  type NoteGraphFilterPreference,
} from './graphFilterPreference'
import { getNoteGraphPerformanceLimits } from './graphPerformancePreference'
import { applyGraphTagFilter } from './graphTagFilter'
import { applyGraphRecentActivityFilter } from './graphRecentActivityFilter'
import type { NoteGraphEdge, NoteGraphLimit, NoteGraphNode, NoteGraphSnapshot } from './types'

/** Compact-tier defaults; UI caps come from {@link getNoteGraphPerformanceLimits}. */
export const NOTE_GRAPH_MAX_NODES = 120
export const NOTE_GRAPH_MAX_EDGES = 200

function currentGraphCaps(): { maxNodes: number; maxEdges: number } {
  return getNoteGraphPerformanceLimits()
}

type NoteGraphTopology = Omit<NoteGraphSnapshot, 'viewport'>

function buildGraphLimit(shownNodes: number, shownEdges: number, capped: boolean): NoteGraphLimit | null {
  if (!capped) return null
  const { maxNodes, maxEdges } = currentGraphCaps()
  return {
    shownNodes,
    shownEdges,
    maxNodes,
    maxEdges,
  }
}

const DEFAULT_DEPTH = DEFAULT_NOTE_GRAPH_DEPTH

let topologyRootDocKey: DocKey | null = null
let depth = DEFAULT_DEPTH
let graphDataRevision = 0
let graphVaultId: string | null = null
let graphVaultRevision = 0
let appliedGraphVaultRevision = 0

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

let globalRouteCenterDocKey: DocKey | null = null

type LayoutSeed = {
  center: DocKey | null
  depth: number
  filterKey: string
  global: boolean
  nodes: NoteGraphNode[]
}

let layoutSeed: LayoutSeed | null = null

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
  return `${filters.showUnresolved ? 'u1' : 'u0'}:${filters.showHeadingNodes ? 'h1' : 'h0'}:${filters.showOrphanNotes ? 'o1' : 'o0'}:${filters.colorByTag ? 'c1' : 'c0'}:${filters.filterTag ?? ''}:${filters.recentActivity}:${filters.edgeDirection}`
}

let globalHubExpansion: {
  filterKey: string
  extraNodes: TopologyNode[]
  extraEdges: NoteGraphEdge[]
} | null = null

function clearGlobalHubExpansion(): void {
  globalHubExpansion = null
}

function isOrphanDocument(docKey: DocKey): boolean {
  if (!getDocumentMeta(docKey)) return false
  if (getIncomingLinkRefs(docKey).length > 0) return false
  for (const ref of getOutgoingLinkRefs(docKey)) {
    if (ref.target.status !== 'resolved') continue
    const targetKey = ref.target.docKey
    if (targetKey && targetKey !== docKey) return false
  }
  return true
}

function captureLayoutSeed(): void {
  if (cachedSubgraph) {
    layoutSeed = {
      center: cachedSubgraph.center,
      depth: cachedSubgraph.depth,
      filterKey: cachedSubgraph.filterKey,
      global: false,
      nodes: cachedSubgraph.nodes,
    }
    return
  }
  if (lastTopology.nodes.length > 0 && topologyRootDocKey === null) {
    layoutSeed = {
      center: globalRouteCenterDocKey,
      depth,
      filterKey: graphFilterKey(getNoteGraphFilterPreference()),
      global: true,
      nodes: lastTopology.nodes,
    }
  }
}

function resolvePrevLayoutNodes(
  center: DocKey | null,
  subgraphDepth: number,
  filterKey: string,
  global: boolean,
): readonly NoteGraphNode[] | undefined {
  if (
    cachedSubgraph &&
    cachedSubgraph.center === center &&
    cachedSubgraph.depth === subgraphDepth &&
    cachedSubgraph.filterKey === filterKey
  ) {
    return cachedSubgraph.nodes
  }
  if (
    layoutSeed &&
    layoutSeed.center === center &&
    layoutSeed.depth === subgraphDepth &&
    layoutSeed.filterKey === filterKey &&
    layoutSeed.global === global
  ) {
    return layoutSeed.nodes
  }
  return undefined
}

function detectLayoutDensity(
  topoNodes: readonly TopologyNode[],
  edges: readonly NoteGraphEdge[],
): GraphLayoutOptions['layoutDensity'] {
  const nodeCount = topoNodes.length
  if (nodeCount === 0) return undefined
  const headingCount = topoNodes.filter((node) => node.id.startsWith('heading:')).length
  const unresolvedCount = topoNodes.filter((node) => node.status === 'unresolved').length
  const edgeDensity = edges.length / nodeCount
  if (headingCount >= 3) return 'dense'
  if (headingCount >= 2 && (unresolvedCount >= 1 || edgeDensity >= 1.35)) return 'dense'
  if (nodeCount >= 8 && edgeDensity >= 1.75) return 'dense'
  if (nodeCount <= 40 && headingCount >= 1 && edgeDensity >= 1.25) return 'dense'
  return undefined
}

function buildLayoutOptionsForTopology(
  topoNodes: TopologyNode[],
  centerDocKey: DocKey | null,
  edges: readonly NoteGraphEdge[],
  prevNodes?: readonly NoteGraphNode[],
  layoutScope: GraphLayoutScope = 'local',
): GraphLayoutOptions {
  const isGlobal = layoutScope === 'global'
  const centerNodeId = isGlobal ? null : centerDocKey ? `page:${centerDocKey}` : null
  const layoutDensity = detectLayoutDensity(topoNodes, edges)
  const isDense = layoutDensity === 'dense'
  const nodeCount = topoNodes.length
  const edgeCount = edges.length
  const edgeDensity = nodeCount > 0 ? edgeCount / nodeCount : 0

  const baseMinDist = isGlobal
    ? isDense
      ? Math.round(108 + Math.min(nodeCount, 80) * 0.42)
      : Math.round(88 + Math.min(nodeCount, 60) * 0.45)
    : isDense
      ? 84
      : edgeDensity >= 2.5
        ? 68
        : edgeDensity >= 1.8
          ? 60
          : nodeCount <= 16
            ? 78
            : undefined
  const baseLinkIdeal = isGlobal
    ? isDense
      ? Math.round(162 + Math.min(nodeCount, 80) * 0.48)
      : Math.round(132 + Math.min(nodeCount, 60) * 0.52)
    : isDense
      ? 126
      : nodeCount <= 16
        ? 116
        : nodeCount <= 24
          ? 108
          : undefined
  const baseIterations = isGlobal ? (isDense ? 128 : 112) : isDense ? 112 : nodeCount <= 16 ? 100 : 80

  const nodeReferenceWeights = buildGraphNodeReferenceCounts(topoNodes, edges)
  const nodeLabelChars = new Map(topoNodes.map((node) => [node.id, node.label.length] as const))
  const sharedLayout = {
    centerNodeId,
    layoutScope,
    nodeReferenceWeights,
    nodeLabelChars,
    ...(layoutDensity ? { layoutDensity } : {}),
    ...(baseMinDist != null ? { minNodeDistance: baseMinDist } : {}),
    ...(baseLinkIdeal != null ? { linkIdealLength: baseLinkIdeal } : {}),
    iterations: baseIterations,
  }

  if (!prevNodes?.length) {
    return sharedLayout
  }

  const topoIds = new Set(topoNodes.map((node) => node.id))
  const initialPositions = new Map<string, { x: number; y: number }>()
  const pinNodeIds = new Set<string>()
  for (const node of prevNodes) {
    if (!topoIds.has(node.id)) continue
    const override = getGraphNodePositionOverride(node.id)
    initialPositions.set(node.id, override ?? { x: node.x, y: node.y })
    if (override) {
      pinNodeIds.add(node.id)
    }
  }
  if (initialPositions.size === 0) {
    return sharedLayout
  }

  return {
    ...sharedLayout,
    initialPositions,
    pinNodeIds,
  }
}

function buildIncrementalLayoutOptions(
  topoNodes: TopologyNode[],
  centerDocKey: DocKey | null,
  prevNodes?: readonly NoteGraphNode[],
  edges?: readonly NoteGraphEdge[],
  layoutScope: GraphLayoutScope = 'local',
) {
  return buildLayoutOptionsForTopology(topoNodes, centerDocKey, edges ?? [], prevNodes, layoutScope)
}

/** Keep the route-centered note visible in global topology even when it has no wiki links yet. */
function ensureRouteCenterTopologyNode(
  routeCenter: DocKey | null,
  nodeMap: Map<string, TopologyNode>,
  graphNodeById: Map<string, { label?: string; raw?: string }>,
  addNode: (
    id: string,
    docKey: DocKey,
    status: 'resolved' | 'unresolved',
    label?: string,
    heading?: string,
  ) => void,
): void {
  if (!routeCenter || !getDocumentMeta(routeCenter)) return
  const pageId = `page:${routeCenter}`
  if (nodeMap.has(pageId)) return
  const displayLabel = graphNodeDisplayLabel(routeCenter, 'resolved', graphNodeById.get(pageId))
  addNode(pageId, routeCenter, 'resolved', displayLabel)
}

function collectFilteredGlobalGraph(
  routeCenter: DocKey | null,
  filters: NoteGraphFilterPreference,
  subgraphDepth: number,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[]; limitReached: boolean } {
  if (routeCenter && filters.edgeDirection !== 'all') {
    return collectLocalSubgraph(routeCenter, subgraphDepth, filters)
  }

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
    if (limitReached || edges.length >= currentGraphCaps().maxEdges) {
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
    if (limitReached || nodeMap.size >= currentGraphCaps().maxNodes) {
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

  const global = getGraphViewState()
  for (const node of global.nodes) {
    if (limitReached) break
    if (!node.docKey) continue
    if (node.kind !== 'page' && node.kind !== 'unresolved') continue
    const status = node.status ?? (node.kind === 'unresolved' ? 'unresolved' : 'resolved')
    if (status === 'unresolved' && !filters.showUnresolved) continue
    const displayLabel = graphNodeDisplayLabel(node.docKey, status, graphNodeById.get(node.id))
    addNode(node.id, node.docKey, status, displayLabel)
  }

  if (filters.showHeadingNodes) {
    for (const pageNode of nodeMap.values()) {
      if (!pageNode.id.startsWith('page:')) continue
      for (const ref of getOutgoingLinkRefs(pageNode.docKey)) {
        if (ref.target.status !== 'resolved') continue
        if (ref.target.docKey !== pageNode.docKey) continue
        const headingLabel = ref.heading ?? ref.target.label ?? ref.target.canonical
        if (!headingLabel) continue
        const headingSlug = canonicalizeWikiLinkText(headingLabel)
        if (!headingSlug) continue
        const headingId = `heading:${pageNode.docKey}:${headingSlug}`
        addNode(headingId, pageNode.docKey, 'resolved', headingLabel, headingLabel)
        tryAddEdge(
          `out-heading:${pageNode.docKey}:${headingId}`,
          pageNode.id,
          headingId,
          ref.kind === 'embed' ? 'embed' : 'link',
        )
      }
    }
  }

  for (const edge of global.edges) {
    if (limitReached) break
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) continue
    tryAddEdge(edge.id, edge.from, edge.to, edge.kind === 'embed' ? 'embed' : 'link')
  }

  if (filters.showOrphanNotes) {
    for (const meta of listDocumentMetas()) {
      if (limitReached) break
      const docKey = meta.docKey
      if (!isOrphanDocument(docKey)) continue
      const pageId = `page:${docKey}`
      if (nodeMap.has(pageId)) continue
      const displayLabel = graphNodeDisplayLabel(docKey, 'resolved', graphNodeById.get(pageId))
      addNode(pageId, docKey, 'resolved', displayLabel)
    }
  }

  ensureRouteCenterTopologyNode(routeCenter, nodeMap, graphNodeById, addNode)

  return finalizeTopologyCollection([...nodeMap.values()], edges, filters, routeCenter, limitReached)
}

function finalizeTopologyCollection(
  nodes: TopologyNode[],
  edges: NoteGraphEdge[],
  filters: NoteGraphFilterPreference,
  routeCenter: DocKey | null,
  limitReached: boolean,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[]; limitReached: boolean } {
  const tagged = applyGraphTagFilter(
    nodes as NoteGraphNode[],
    edges,
    filters.filterTag,
    routeCenter,
  )
  const recent = applyGraphRecentActivityFilter(
    tagged.nodes,
    tagged.edges,
    filters.recentActivity,
    routeCenter,
  )
  return {
    nodes: recent.nodes as TopologyNode[],
    edges: recent.edges,
    limitReached,
  }
}

function mergeGlobalHubExpansion(
  nodes: TopologyNode[],
  edges: NoteGraphEdge[],
  filterKey: string,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[]; limitReached: boolean } {
  if (!globalHubExpansion || globalHubExpansion.filterKey !== filterKey) {
    return { nodes, edges, limitReached: false }
  }
  const { maxNodes, maxEdges } = currentGraphCaps()
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  let limitReached = nodeMap.size >= maxNodes
  for (const node of globalHubExpansion.extraNodes) {
    if (nodeMap.size >= maxNodes) {
      limitReached = true
      break
    }
    if (!nodeMap.has(node.id)) nodeMap.set(node.id, node)
  }
  const mergedEdges = [...edges]
  const edgeIds = new Set(edges.map((edge) => edge.id))
  for (const edge of globalHubExpansion.extraEdges) {
    if (mergedEdges.length >= maxEdges) {
      limitReached = true
      break
    }
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to) || edgeIds.has(edge.id)) continue
    mergedEdges.push(edge)
    edgeIds.add(edge.id)
  }
  return { nodes: [...nodeMap.values()], edges: mergedEdges, limitReached }
}

function collectHubNeighborTopology(
  hubDocKey: DocKey,
): { nodes: TopologyNode[]; edges: NoteGraphEdge[] } {
  const graphNodeById = new Map(getGraphSnapshot().nodes.map((node) => [node.id, node]))
  const nodeMap = new Map<string, TopologyNode>()
  const edges: NoteGraphEdge[] = []
  const edgeSeen = new Set<string>()

  const addPage = (docKey: DocKey) => {
    if (!getDocumentMeta(docKey)) return
    const pageId = `page:${docKey}`
    if (nodeMap.has(pageId)) return
    const label = graphNodeDisplayLabel(docKey, 'resolved', graphNodeById.get(pageId))
    nodeMap.set(pageId, {
      id: pageId,
      docKey,
      label,
      status: 'resolved',
      navigable: true,
    })
  }

  const tryEdge = (from: string, to: string, edgeId: string, kind: NoteGraphEdge['kind']) => {
    if (edgeSeen.has(edgeId) || !nodeMap.has(from) || !nodeMap.has(to)) return
    edgeSeen.add(edgeId)
    edges.push({ id: edgeId, from, to, kind })
  }

  addPage(hubDocKey)
  const hubPageId = `page:${hubDocKey}`

  for (const ref of getOutgoingLinkRefs(hubDocKey)) {
    if (ref.target.status !== 'resolved' || !ref.target.docKey) continue
    addPage(ref.target.docKey)
    tryEdge(
      hubPageId,
      `page:${ref.target.docKey}`,
      `out:${hubDocKey}:${ref.target.docKey}`,
      ref.kind === 'embed' ? 'embed' : 'link',
    )
  }

  for (const ref of getIncomingLinkRefs(hubDocKey)) {
    if (ref.target.status !== 'resolved') continue
    addPage(ref.sourceDocKey)
    tryEdge(
      `page:${ref.sourceDocKey}`,
      hubPageId,
      `in:${ref.sourceDocKey}:${hubDocKey}`,
      ref.kind === 'embed' ? 'embed' : 'link',
    )
  }

  return { nodes: [...nodeMap.values()], edges }
}

/** Cap BFS expansion from high-degree non-root nodes to avoid hub starbursts. */
const LOCAL_SUBGRAPH_NEIGHBOR_BUDGET = 12
const LOCAL_SUBGRAPH_NEIGHBOR_BUDGET_THRESHOLD = 10

function localSubgraphNeighborPriority(
  target: DocKey,
  targetStatus: 'resolved' | 'unresolved',
  depth: number,
  alreadyVisible: boolean,
): number {
  let score = depth * 8
  if (alreadyVisible) score -= 24
  if (targetStatus === 'unresolved') score += 18
  score += target.length * 0.02
  return score
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
    if (limitReached || edges.length >= currentGraphCaps().maxEdges) {
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
    if (limitReached || nodeMap.size >= currentGraphCaps().maxNodes) {
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
      type OutgoingCandidate = {
        target: DocKey
        targetId: string
        targetStatus: 'resolved' | 'unresolved'
        kind: NoteGraphEdge['kind']
        priority: number
      }
      const outgoingCandidates: OutgoingCandidate[] = []
      for (const e of getOutgoingEdges(key)) {
        const target = e.targetDocKey ?? nodeDocKeyFromId(e.to)
        let targetStatus = e.targetStatus ?? 'resolved'
        if (targetStatus === 'resolved' && !getDocumentMeta(target)) {
          targetStatus = 'unresolved'
        }
        if (d + 1 > maxDepth) continue
        if (targetStatus === 'unresolved' && !filters.showUnresolved) continue
        outgoingCandidates.push({
          target,
          targetId: e.to,
          targetStatus,
          kind: e.kind === 'embed' ? 'embed' : 'link',
          priority: localSubgraphNeighborPriority(
            target,
            targetStatus,
            d + 1,
            nodeMap.has(e.to),
          ),
        })
      }
      outgoingCandidates.sort(
        (a, b) => a.priority - b.priority || a.target.localeCompare(b.target),
      )
      const outgoingLimited =
        d === 0 || outgoingCandidates.length <= LOCAL_SUBGRAPH_NEIGHBOR_BUDGET_THRESHOLD
          ? outgoingCandidates
          : outgoingCandidates.slice(0, LOCAL_SUBGRAPH_NEIGHBOR_BUDGET)
      for (const candidate of outgoingLimited) {
        const { target, targetId, targetStatus, kind } = candidate
        const displayLabel = graphNodeDisplayLabel(target, targetStatus, graphNodeById.get(targetId))
        addNode(targetId, target, targetStatus, displayLabel)
        tryAddEdge(`out:${key}:${target}`, `page:${key}`, targetId, kind)
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
      type IncomingCandidate = {
        source: DocKey
        kind: NoteGraphEdge['kind']
        priority: number
      }
      const incomingCandidates: IncomingCandidate[] = []
      for (const e of getIncomingEdges(key)) {
        const source = e.sourceDocKey as DocKey
        if (!getDocumentMeta(source)) continue
        if (d + 1 > maxDepth) continue
        incomingCandidates.push({
          source,
          kind: e.kind === 'embed' ? 'embed' : 'link',
          priority: localSubgraphNeighborPriority(
            source,
            'resolved',
            d + 1,
            nodeMap.has(`page:${source}`),
          ),
        })
      }
      incomingCandidates.sort(
        (a, b) => a.priority - b.priority || a.source.localeCompare(b.source),
      )
      const incomingLimited =
        d === 0 || incomingCandidates.length <= LOCAL_SUBGRAPH_NEIGHBOR_BUDGET_THRESHOLD
          ? incomingCandidates
          : incomingCandidates.slice(0, LOCAL_SUBGRAPH_NEIGHBOR_BUDGET)
      for (const candidate of incomingLimited) {
        const { source, kind } = candidate
        addNode(`page:${source}`, source, 'resolved')
        tryAddEdge(`in:${source}:${key}`, `page:${source}`, `page:${key}`, kind)
        if (d + 1 < maxDepth) visit(source, d + 1)
      }
    }
  }

  visit(root, 0)

  return finalizeTopologyCollection([...nodeMap.values()], edges, filters, root, limitReached)
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
  layoutScope: GraphLayoutScope = 'local',
): NoteGraphNode[] {
  markLayoutPhysicsActivity('force-layout')
  const positions = computeGraphLayout(
    topoNodes.map((n) => ({ id: n.id })),
    edges.map((e) => ({ from: e.from, to: e.to })),
    buildIncrementalLayoutOptions(topoNodes, centerDocKey, prevNodes, edges, layoutScope),
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
  const prevNodes = resolvePrevLayoutNodes(center, subgraphDepth, filterKey, false)
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
  layoutSeed = null
  cachedSubgraph = null
  clearGlobalHubExpansion()
  clearGraphNodePositionOverrides()
  bumpGraphLayoutRevision()
}

function invalidateGraphDataCachePreservingLayout(): void {
  captureLayoutSeed()
  cachedSubgraph = null
  bumpGraphLayoutRevision()
}

/** Drop cached subgraph after link graph / registry mutations (e.g. deleted target file). */
export function invalidateNoteGraphSubgraphCache(): void {
  invalidateGraphDataCachePreservingLayout()
}

/** Workspace switch: invalidate subgraph cache even when route docKey is unchanged. */
export function notifyNoteGraphVaultChanged(vaultId: string | null): void {
  const next = vaultId?.trim() || null
  if (next === graphVaultId) return
  graphVaultId = next
  graphVaultRevision += 1
  invalidateGraphDataCache()
  lastTopology = {
    centerDocKey: null,
    depth: DEFAULT_DEPTH,
    nodes: [],
    edges: [],
    revision: 0,
    graphLimit: null,
  }
}

function consumeGraphVaultRevisionChange(): boolean {
  if (appliedGraphVaultRevision === graphVaultRevision) return false
  appliedGraphVaultRevision = graphVaultRevision
  return true
}

function rebuildSnapshot(): void {
  safeGraphUpdate(() => {
    listeners.forEach((fn) => fn())
  })
}

/** True when the graph shows workspace-wide topology (no route-centered subgraph root). */
export function isNoteGraphGlobalTopology(): boolean {
  return topologyRootDocKey === null
}

/** True while the visible subgraph still uses the synchronous grid fallback (force layout pending). */
export function isNoteGraphOnFallbackLayout(): boolean {
  return cachedSubgraph?.layoutKind === 'fallback'
}

/**
 * Fullscreen / workspace-wide graph: all vault nodes up to NOTE_GRAPH_MAX_* caps.
 */
export function syncNoteGraphTopologyGlobal(
  routeCenterDocKey: DocKey | null = null,
  options?: { preserveLayout?: boolean },
): void {
  const prev = topologyRootDocKey
  consumeGraphVaultRevisionChange()
  globalRouteCenterDocKey = routeCenterDocKey ?? globalRouteCenterDocKey
  topologyRootDocKey = null
  if (options?.preserveLayout) {
    invalidateGraphDataCachePreservingLayout()
  } else {
    invalidateGraphDataCache()
  }

  const ownsGraph = beginGraphUpdate()
  try {
    if (prev !== null && !isKnowledgeOSBooting()) {
      refreshGraphViewIncremental()
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
  const vaultChanged = consumeGraphVaultRevisionChange()
  if (docKey === prev && !depthChanged && !filtersChanged && !vaultChanged) return

  topologyRootDocKey = docKey
  depth = nextDepth
  if (docKey === prev && !depthChanged && filtersChanged) {
    invalidateGraphDataCachePreservingLayout()
  } else {
    invalidateGraphDataCache()
  }

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

/** Expand a hub: local mode increases depth; global mode merges one-hop neighbors. */
export function expandNoteGraphHub(nodeId: string): boolean {
  if (!nodeId.startsWith('page:')) return false
  const docKey = docKeyFromNodeId(nodeId)
  if (!docKey) return false

  const ownsGraph = beginGraphUpdate()
  try {
    if (topologyRootDocKey !== null) {
      const nextDepth = Math.min(MAX_NOTE_GRAPH_DEPTH, depth + 1)
      if (nextDepth === depth) return false
      depth = nextDepth
      setNoteGraphDepthPreference(nextDepth)
      invalidateGraphDataCachePreservingLayout()
      buildSubgraphWithLayout(topologyRootDocKey, depth)
      rebuildSnapshot()
      notifyGraphTopologyReady()
      return true
    }

    const filters = getNoteGraphFilterPreference()
    const filterKey = graphFilterKey(filters)
    const neighbor = collectHubNeighborTopology(docKey)
    if (neighbor.nodes.length <= 1 && neighbor.edges.length === 0) return false

    const extraNodes =
      globalHubExpansion?.filterKey === filterKey ? [...globalHubExpansion.extraNodes] : []
    const extraEdges =
      globalHubExpansion?.filterKey === filterKey ? [...globalHubExpansion.extraEdges] : []
    const nodeIds = new Set(extraNodes.map((node) => node.id))
    for (const node of neighbor.nodes) {
      if (node.id === nodeId || nodeIds.has(node.id)) continue
      nodeIds.add(node.id)
      extraNodes.push(node)
    }
    const edgeIds = new Set(extraEdges.map((edge) => edge.id))
    for (const edge of neighbor.edges) {
      if (edgeIds.has(edge.id)) continue
      edgeIds.add(edge.id)
      extraEdges.push(edge)
    }

    globalHubExpansion = { filterKey, extraNodes, extraEdges }
    invalidateGraphDataCachePreservingLayout()
    rebuildSnapshot()
    notifyGraphTopologyReady()
    return true
  } finally {
    if (ownsGraph) endGraphUpdate()
  }
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

export function setGraphNodeManualPosition(nodeId: string, position: { x: number; y: number }): void {
  setGraphNodePositionOverride(nodeId, position)
  if (cachedSubgraph) {
    cachedSubgraph = {
      ...cachedSubgraph,
      nodes: cachedSubgraph.nodes.map((n) =>
        n.id === nodeId ? { ...n, x: position.x, y: position.y } : n,
      ),
    }
  }
  markLayoutPhysicsActivity('node-position')
  rebuildSnapshot()
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
      const filters = getNoteGraphFilterPreference()
      const filterKey = graphFilterKey(filters)
      const routeCenter = globalRouteCenterDocKey
      const topo = collectFilteredGlobalGraph(routeCenter, filters, depth)
      const merged = mergeGlobalHubExpansion(topo.nodes, topo.edges, filterKey)
      const finalized = finalizeTopologyCollection(
        merged.nodes,
        merged.edges,
        filters,
        routeCenter,
        topo.limitReached || merged.limitReached,
      )
      const prevNodes = resolvePrevLayoutNodes(routeCenter, depth, filterKey, true)
      const layoutNodes = applyGraphNodePositionOverrides(
        shouldDeferGraphForceLayout()
          ? applyFallbackLayout(finalized.nodes, prevNodes)
          : applyForceLayout(finalized.nodes, finalized.edges, null, prevNodes, 'global'),
      )
      const visibleEdges = finalized.edges.filter(
        (edge) =>
          layoutNodes.some((node) => node.id === edge.from) &&
          layoutNodes.some((node) => node.id === edge.to),
      )
      const graphLimit = buildGraphLimit(
        layoutNodes.length,
        visibleEdges.length,
        finalized.limitReached,
      )
      lastTopology = {
        centerDocKey: null,
        depth,
        nodes: layoutNodes,
        edges: visibleEdges,
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
      nodes: applyGraphNodePositionOverrides(cached.nodes),
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
    if (isKnowledgeOSBooting()) return
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
  globalRouteCenterDocKey = null
  depth = DEFAULT_DEPTH
  graphDataRevision = 0
  graphVaultId = null
  graphVaultRevision = 0
  appliedGraphVaultRevision = 0
  graphInteracting = false
  snapshotReadDepth = 0
  lazyLayoutScheduled = false
  setGraphLazyLayoutPending(false)
  layoutSeed = null
  cachedSubgraph = null
  clearGraphNodePositionOverrides()
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
