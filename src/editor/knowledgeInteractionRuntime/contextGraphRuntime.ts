import {
  getDocumentMeta,
  getIncomingEdges,
  getOutgoingEdges,
  getDocumentsByTag,
} from '../knowledgeRuntime'
import { graphNeighborhoodCache } from './contextCache'
import { emitInteractionEvent } from './interactionEvents'
import { scheduleInteractionTask } from './interactionScheduler'
import type { ContextGraphEdge, ContextGraphNode } from './types'
import type { DocKey } from '../knowledgeRuntime/types'

export type ContextGraphSnapshot = {
  docKey: DocKey
  nodes: ContextGraphNode[]
  edges: ContextGraphEdge[]
  revision: number
  focusMode: boolean
}

let focusMode = false
let revision = 0

export function setContextGraphFocusMode(enabled: boolean): void {
  focusMode = enabled
}

export function buildContextGraphIncremental(centerDocKey: DocKey): ContextGraphSnapshot {
  const cacheKey = `ctx:${centerDocKey}:${focusMode}`
  const meta = getDocumentMeta(centerDocKey)
  const contentHash = meta?.contentHash ?? centerDocKey
  const cached = graphNeighborhoodCache.get(cacheKey, contentHash) as ContextGraphSnapshot | undefined
  if (cached) return cached

  const nodes: ContextGraphNode[] = []
  const edges: ContextGraphEdge[] = []
  const seen = new Set<string>()

  const addNode = (docKey: DocKey, label: string, role: ContextGraphNode['role'], angle: number, r: number) => {
    const id = `page:${docKey}`
    if (seen.has(id)) return
    seen.add(id)
    nodes.push({
      id,
      docKey,
      label,
      role,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    })
  }

  addNode(centerDocKey, meta?.title ?? centerDocKey, 'current', 0, 0)

  const incoming = getIncomingEdges(centerDocKey)
  incoming.forEach((e, i) => {
    const src = e.sourceDocKey
    const srcMeta = getDocumentMeta(src)
    addNode(src, srcMeta?.title ?? src, 'backlink', (i / Math.max(1, incoming.length)) * Math.PI * 2, 100)
    edges.push({
      id: `bl:${src}->${centerDocKey}`,
      from: `page:${src}`,
      to: `page:${centerDocKey}`,
      kind: 'backlink',
    })
  })

  const outgoing = getOutgoingEdges(centerDocKey)
  outgoing.forEach((e, i) => {
    const target = e.to.replace(/^page:/u, '')
    const tgtMeta = getDocumentMeta(target)
    addNode(target, tgtMeta?.title ?? target, 'forward', Math.PI + (i / Math.max(1, outgoing.length)) * Math.PI, 120)
    edges.push({
      id: `fw:${centerDocKey}->${target}`,
      from: `page:${centerDocKey}`,
      to: e.to,
      kind: 'link',
    })
  })

  const tags = meta?.outboundTags ?? []
  tags.slice(0, focusMode ? 3 : 8).forEach((tag, i) => {
    const related = getDocumentsByTag(tag).filter((k) => k !== centerDocKey).slice(0, 4)
    related.forEach((docKey, j) => {
      const angle = (i * 0.7 + j * 0.15) * Math.PI
      const rm = getDocumentMeta(docKey)
      addNode(docKey, rm?.title ?? docKey, 'tag', angle, 160 + j * 20)
      edges.push({
        id: `tag:${centerDocKey}:${docKey}:${tag}`,
        from: `page:${centerDocKey}`,
        to: `page:${docKey}`,
        kind: 'tag',
      })
    })
  })

  revision += 1
  const snapshot: ContextGraphSnapshot = {
    docKey: centerDocKey,
    nodes,
    edges,
    revision,
    focusMode,
  }
  graphNeighborhoodCache.set(cacheKey, snapshot, contentHash)
  return snapshot
}

export function scheduleContextGraphUpdate(
  centerDocKey: DocKey,
  onReady: (snapshot: ContextGraphSnapshot) => void,
): void {
  scheduleInteractionTask({
    key: `ctx-graph:${centerDocKey}`,
    kind: 'graph-layout',
    priority: 'background',
    run: () => {
      const snapshot = buildContextGraphIncremental(centerDocKey)
      onReady(snapshot)
      emitInteractionEvent('context-updated', {
        docKey: centerDocKey,
        revision: snapshot.revision,
      })
    },
  })
}

export function getVisibleContextNodes(
  snapshot: ContextGraphSnapshot,
  width: number,
  height: number,
  viewport: { x: number; y: number; zoom: number },
): ContextGraphNode[] {
  const pad = 60
  const minX = (-viewport.x - pad) / viewport.zoom
  const minY = (-viewport.y - pad) / viewport.zoom
  const maxX = (width - viewport.x + pad) / viewport.zoom
  const maxY = (height - viewport.y + pad) / viewport.zoom
  return snapshot.nodes.filter(
    (n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY,
  )
}

export function resetContextGraphRuntime(): void {
  focusMode = false
  revision = 0
}
