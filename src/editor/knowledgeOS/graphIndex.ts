import type { DocKey } from '../knowledgeRuntime/types'
import { getNoteGraphTopology } from './noteGraphRuntime'
import type { NoteGraphNode } from './types'

function pageNodeId(docKey: DocKey): string {
  return `page:${docKey}`
}

/** Find nodes by docKey in the current topology.*/
export function getGraphNodeByDocKey(docKey: DocKey): NoteGraphNode | null {
  const topo = getNoteGraphTopology()
  return topo.nodes.find((n) => n.docKey === docKey) ?? null
}

/** Find nodes by node id in the current topology.*/
export function getGraphNodeById(nodeId: string): NoteGraphNode | null {
  const topo = getNoteGraphTopology()
  return topo.nodes.find((n) => n.id === nodeId) ?? null
}

/** @deprecated using getGraphNodeById*/
export function getNode(nodeId: string): NoteGraphNode | null {
  return getGraphNodeById(nodeId)
}

export function parseBacklinkIdToDocKey(backlinkId: string): DocKey | null {
  if (!backlinkId) return null
  if (backlinkId.startsWith('inbound:')) {
    const parts = backlinkId.split(':')
    return parts[1] ?? null
  }
  if (backlinkId.startsWith('outbound:')) {
    return backlinkId.slice('outbound:'.length) || null
  }
  return backlinkId
}

export function backlinkIdForInbound(sourceDocKey: DocKey, itemIndex: number): string {
  return `inbound:${sourceDocKey}:${itemIndex}`
}

export function backlinkIdForOutbound(targetDocKey: DocKey): string {
  return `outbound:${targetDocKey}`
}

export function backlinkIdForDoc(docKey: DocKey): string {
  return docKey
}

/**
 * backlinkId → graph node; docKey is still returned when there is no node in the topology (continue flushing after navigation).
 */
export function resolveBacklinkTarget(backlinkId: string): {
  docKey: DocKey
  nodeId: string | null
} | null {
  const docKey = parseBacklinkIdToDocKey(backlinkId)
  if (!docKey) {
    console.warn('[Backlink] unresolved target:', backlinkId)
    return null
  }

  const node = getGraphNodeByDocKey(docKey)
  if (!node) {
    console.warn('[Backlink] unresolved target:', backlinkId)
    return { docKey, nodeId: pageNodeId(docKey) }
  }

  return { docKey: node.docKey, nodeId: node.id }
}
