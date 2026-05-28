import { emitKnowledgeEvent } from './knowledgeEvents'
import { listDocumentMetas, resolveDocKey } from './knowledgeRegistry'
import { resolveCanonicalIdentity } from './canonicalIdentity'
import {
  getIncomingLinkRefs,
  getOutgoingLinkRefsReadonly,
  linkIncomingLookupKeys,
  linkIncomingStorageKey,
  listOutgoingDocKeys,
} from './linkGraphIndex'
import { resolveWikiLinkTarget } from './wikiLinkResolver'
import { wikiLinkInnerTargetText } from './wikiLinkParser'
import type { CanonicalDocumentTarget, DocKey, GraphEdge, GraphEdgeKind, GraphNode, GraphNodeKind } from './types'

type GraphState = {
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  outgoing: Map<DocKey, Set<string>>
  incoming: Map<DocKey, Set<string>>
}

const graph: GraphState = {
  nodes: new Map(),
  edges: new Map(),
  outgoing: new Map(),
  incoming: new Map(),
}

function pruneDanglingNodes(): void {
  if (graph.nodes.size === 0) return
  const referenced = new Set<string>()
  for (const edge of graph.edges.values()) {
    referenced.add(edge.from)
    referenced.add(edge.to)
  }
  for (const [nodeId, node] of graph.nodes) {
    if (node.kind === 'page' && node.status === 'resolved') {
      const docKey = node.docKey
      if (docKey && resolveDocKey(docKey)) continue
    }
    if (!referenced.has(nodeId)) graph.nodes.delete(nodeId)
  }
}

function nodeId(kind: GraphNodeKind, key: string): string {
  return `${kind}:${key}`
}

export function ensurePageNode(docKey: DocKey, label: string): GraphNode {
  const id = nodeId('page', docKey)
  let n = graph.nodes.get(id)
  if (!n) {
    n = { id, kind: 'page', status: 'resolved', docKey, label }
    graph.nodes.set(id, n)
  } else if (n.label !== label) {
    n = { ...n, label }
    graph.nodes.set(id, n)
  }
  return n
}

export function ensureUnresolvedNode(target: CanonicalDocumentTarget): GraphNode {
  const id = target.docKey
  let n = graph.nodes.get(id)
  const label = target.label ?? target.canonical ?? target.docKey
  if (!n) {
    n = {
      id,
      kind: 'unresolved',
      status: 'unresolved',
      docKey: target.docKey,
      label,
      canonical: target.canonical,
      raw: target.raw,
      heading: target.anchor?.headingSlug,
      blockId: target.anchor?.blockId,
    }
    graph.nodes.set(id, n)
  } else if (n.label !== label) {
    n = { ...n, label, canonical: target.canonical, raw: target.raw }
    graph.nodes.set(id, n)
  }
  return n
}

export function ensureTagNode(tag: string): GraphNode {
  const id = nodeId('tag', tag)
  let n = graph.nodes.get(id)
  if (!n) {
    n = { id, kind: 'tag', tag, label: `#${tag}` }
    graph.nodes.set(id, n)
  }
  return n
}

function incomingStorageKeyForEdge(edge: GraphEdge): DocKey {
  if (edge.targetStatus === 'resolved') {
    const resolved = resolveDocKey(edge.targetDocKey ?? '')
    if (resolved) return resolved
  }
  return linkIncomingStorageKey(edge.targetDocKey ?? edge.to)
}

function resolveRefTargetLive(ref: {
  targetDocKey: DocKey
  target?: CanonicalDocumentTarget
  raw?: string
}): CanonicalDocumentTarget {
  if (!ref.target) {
    const resolved = resolveDocKey(ref.targetDocKey)
    return {
      docKey: ref.targetDocKey,
      status: resolved ? 'resolved' : 'unresolved',
      canonical: ref.targetDocKey,
      label: ref.targetDocKey,
    }
  }
  const linkText =
    ref.target.raw?.trim() ||
    ref.target.label?.trim() ||
    ref.target.canonical?.trim() ||
    wikiLinkInnerTargetText(ref.raw ?? '', ref.target.docKey)
  const fresh = resolveWikiLinkTarget(linkText)
  return {
    ...fresh,
    anchor: ref.target.anchor,
    raw: ref.target.raw ?? fresh.raw,
    label: ref.target.label ?? fresh.label,
    canonical: ref.target.canonical ?? fresh.canonical,
  }
}

export function clearEdgesForSource(sourceDocKey: DocKey): void {
  const out = graph.outgoing.get(sourceDocKey)
  if (!out) return
  for (const edgeId of out) {
    const edge = graph.edges.get(edgeId)
    if (!edge) continue
    graph.edges.delete(edgeId)
    const inc = graph.incoming.get(incomingStorageKeyForEdge(edge))
    inc?.delete(edgeId)
  }
  graph.outgoing.delete(sourceDocKey)
  pruneDanglingNodes()
}

export function addEdge(
  sourceDocKey: DocKey,
  targetDocKey: DocKey,
  kind: GraphEdgeKind,
  edgeKey?: string,
  targetNodeId = nodeId('page', targetDocKey),
  targetStatus: 'resolved' | 'unresolved' = 'resolved',
): GraphEdge {
  const from = nodeId('page', sourceDocKey)
  const to = targetNodeId
  const id = edgeKey ?? `${kind}:${sourceDocKey}->${targetDocKey}`
  const edge: GraphEdge = {
    id,
    kind,
    from,
    to,
    sourceDocKey,
    targetDocKey,
    targetStatus,
  }
  graph.edges.set(id, edge)
  if (!graph.outgoing.has(sourceDocKey)) graph.outgoing.set(sourceDocKey, new Set())
  graph.outgoing.get(sourceDocKey)!.add(id)
  const incomingKey =
    targetStatus === 'resolved'
      ? resolveDocKey(targetDocKey) ?? targetDocKey
      : linkIncomingStorageKey(targetDocKey)
  if (!graph.incoming.has(incomingKey)) graph.incoming.set(incomingKey, new Set())
  graph.incoming.get(incomingKey)!.add(id)
  return edge
}

export function rebuildEdgesForDocument(
  sourceDocKey: DocKey,
  targets: Array<{ targetDocKey: DocKey; kind: GraphEdgeKind; edgeKey?: string }>,
  label: string,
): void {
  clearEdgesForSource(sourceDocKey)
  const sourceKey = resolveDocKey(sourceDocKey)
  if (!sourceKey) return
  ensurePageNode(sourceKey, label)
  for (const t of targets) {
    const targetKey = resolveDocKey(t.targetDocKey)
    if (targetKey) {
      ensurePageNode(targetKey, targetKey.split('/').pop() ?? targetKey)
      addEdge(sourceKey, targetKey, t.kind, t.edgeKey)
    } else {
      const identity = resolveCanonicalIdentity(t.targetDocKey)
      if (identity.status === 'resolved') {
        ensurePageNode(identity.docKey, identity.docKey.split('/').pop() ?? identity.docKey)
        addEdge(sourceKey, identity.docKey, t.kind, t.edgeKey)
        continue
      }
      const unresolved: CanonicalDocumentTarget = {
        docKey: identity.docKey,
        status: identity.status,
        raw: identity.raw,
        canonical: t.targetDocKey,
        label: t.targetDocKey,
      }
      const node = ensureUnresolvedNode(unresolved)
      addEdge(sourceKey, unresolved.docKey, t.kind, t.edgeKey, node.id, 'unresolved')
    }
  }
  emitKnowledgeEvent('graph-updated', {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
  })
}

/** Synchronize visual graph edges from LinkGraphIndex (supports multiple links with the same target).*/
export function rebuildEdgesFromLinkRefs(
  sourceDocKey: DocKey,
  refs: Array<{ targetDocKey: DocKey; target?: CanonicalDocumentTarget; kind: GraphEdgeKind; start: number; end: number }>,
  label: string,
): void {
  clearEdgesForSource(sourceDocKey)
  const sourceKey = resolveDocKey(sourceDocKey)
  if (!sourceKey) return
  ensurePageNode(sourceKey, label)
  for (const ref of refs) {
    const target = resolveRefTargetLive(ref)
    const targetKey = target.status === 'resolved' ? resolveDocKey(target.docKey) : null
    if (targetKey) {
      ensurePageNode(targetKey, targetKey.split('/').pop() ?? targetKey)
      const edgeKey = `${ref.kind}:${sourceKey}:${targetKey}:${ref.start}:${ref.end}`
      addEdge(sourceKey, targetKey, ref.kind, edgeKey)
    } else {
      const node = ensureUnresolvedNode(target)
      const edgeKey = `${ref.kind}:${sourceKey}:${node.id}:${ref.start}:${ref.end}`
      addEdge(sourceKey, target.docKey, ref.kind, edgeKey, node.id, 'unresolved')
    }
  }
  emitKnowledgeEvent('graph-updated', {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
  })
}

export function getGraphSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [...graph.nodes.values()],
    edges: [...graph.edges.values()],
  }
}

export function getIncomingEdges(docKey: DocKey): GraphEdge[] {
  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const key of linkIncomingLookupKeys(docKey)) {
    const ids = graph.incoming.get(key)
    if (!ids) continue
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const edge = graph.edges.get(id)
      if (edge) edges.push(edge)
    }
  }
  return edges
}

export function getOutgoingEdges(docKey: DocKey): GraphEdge[] {
  const ids = graph.outgoing.get(docKey)
  if (!ids) return []
  return [...ids].map((id) => graph.edges.get(id)!).filter(Boolean)
}

/** Synchronize the full visualization graph from LinkGraphIndex (outgoing + incoming).*/
export function rebuildGraphEdgesFromLinkIndex(): void {
  graph.nodes.clear()
  graph.edges.clear()
  graph.outgoing.clear()
  graph.incoming.clear()

  const metaByKey = new Map(listDocumentMetas().map((m) => [m.docKey, m] as const))
  const edgeSeen = new Set<string>()

  const addRefEdge = (ref: {
    sourceDocKey: DocKey
    targetDocKey: DocKey
    target?: CanonicalDocumentTarget
    kind: GraphEdgeKind
    start: number
    end: number
  }) => {
    const edgeKey = `${ref.kind}:${ref.sourceDocKey}:${ref.targetDocKey}:${ref.start}:${ref.end}`
    if (edgeSeen.has(edgeKey)) return
    edgeSeen.add(edgeKey)
    const sourceKey = resolveDocKey(ref.sourceDocKey)
    if (!sourceKey) return
    const target = resolveRefTargetLive(ref)
    const targetKey = target.status === 'resolved' ? resolveDocKey(target.docKey) : null
    const sourceMeta = metaByKey.get(ref.sourceDocKey)
    const label = sourceMeta?.title ?? sourceKey.split('/').pop() ?? sourceKey
    ensurePageNode(sourceKey, label)
    if (targetKey) {
      ensurePageNode(targetKey, targetKey.split('/').pop() ?? targetKey)
      addEdge(sourceKey, targetKey, ref.kind, edgeKey)
    } else {
      const node = ensureUnresolvedNode(target)
      addEdge(sourceKey, target.docKey, ref.kind, edgeKey, node.id, 'unresolved')
    }
  }

  for (const docKey of listOutgoingDocKeys()) {
    for (const ref of getOutgoingLinkRefsReadonly(docKey)) {
      addRefEdge({
        sourceDocKey: ref.sourceDocKey,
        targetDocKey: ref.targetDocKey,
        target: ref.target,
        kind: ref.kind === 'embed' ? 'embed' : 'link',
        start: ref.start,
        end: ref.end,
      })
    }
  }

  for (const meta of metaByKey.values()) {
    for (const ref of getIncomingLinkRefs(meta.docKey)) {
      addRefEdge({
        sourceDocKey: ref.sourceDocKey,
        targetDocKey: ref.targetDocKey,
        target: ref.target,
        kind: ref.kind === 'embed' ? 'embed' : 'link',
        start: ref.start,
        end: ref.end,
      })
    }
  }

  emitKnowledgeEvent('graph-updated', {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
  })
}

export function resetLinkGraph(): void {
  graph.nodes.clear()
  graph.edges.clear()
  graph.outgoing.clear()
  graph.incoming.clear()
}
