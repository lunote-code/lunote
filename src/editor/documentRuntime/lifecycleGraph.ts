import { bumpDocumentTick } from './documentClock'

export type GraphPhase =
  | 'mount'
  | 'hydrate'
  | 'visible'
  | 'interactive'
  | 'background'
  | 'suspended'
  | 'destroyed'

export type GraphNodeKind = 'document' | 'block'

type GraphNode = {
  id: string
  kind: GraphNodeKind
  phase: GraphPhase
  updatedAt: number
}

const DOCUMENT_ID = 'luna:document'
const nodes = new Map<string, GraphNode>()

function setPhase(id: string, kind: GraphNodeKind, phase: GraphPhase): void {
  const prev = nodes.get(id)
  if (prev?.phase === phase) return
  nodes.set(id, { id, kind, phase, updatedAt: Date.now() })
  bumpDocumentTick('render')
}

export function ensureDocumentNode(): void {
  if (!nodes.has(DOCUMENT_ID)) {
    setPhase(DOCUMENT_ID, 'document', 'mount')
  }
}

export function getDocumentPhase(): GraphPhase {
  return nodes.get(DOCUMENT_ID)?.phase ?? 'mount'
}

export function setDocumentPhase(phase: GraphPhase): void {
  ensureDocumentNode()
  setPhase(DOCUMENT_ID, 'document', phase)
}

export function getBlockGraphPhase(blockId: string): GraphPhase {
  return nodes.get(blockId)?.phase ?? 'mount'
}

export function transitionBlockPhase(blockId: string, phase: GraphPhase): void {
  if (!blockId) return
  ensureDocumentNode()
  setPhase(blockId, 'block', phase)
}

export function removeBlockNode(blockId: string): void {
  if (!blockId) return
  transitionBlockPhase(blockId, 'destroyed')
  nodes.delete(blockId)
}

export function clearLifecycleGraph(): void {
  nodes.clear()
}

export function listBlockNodes(): string[] {
  return [...nodes.entries()].filter(([, n]) => n.kind === 'block').map(([id]) => id)
}

/** Map unified viewport state to graph phase*/
export function mapViewportToGraphPhase(args: {
  visible: boolean
  near: boolean
  suspended: boolean
}): GraphPhase {
  if (args.suspended) return 'suspended'
  if (args.visible) return 'visible'
  if (args.near) return 'background'
  return 'background'
}
