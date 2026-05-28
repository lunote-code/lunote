import { getGraphNodeByDocKey, getGraphNodeById } from './graphIndex'
import {
  hasPendingGraphLayoutJobs,
  isGraphLayoutQuiescent,
} from './graphLayoutDependencyRuntime'
import {
  processRenderConvergenceFrame,
  resetRenderConvergenceTracker,
  type GraphRenderFrameSample,
} from './graphRenderConvergence'
import {
  ensureNodeInRenderedSubgraph,
  getNoteGraphTopology,
  isGraphInteracting,
} from './noteGraphRuntime'
import { getPanelLayoutForType } from './surfaceLayoutRuntime'
import type { NoteGraphNode } from './types'

export type { GraphRenderFrameSample } from './graphRenderConvergence'

export type NodeActivationRenderState =
  | 'IDLE'
  | 'ACTIVATING'
  | 'RENDER_PENDING'
  | 'RENDER_STABLE'

export type NodeRenderStablePayload = {
  nodeId: string
  score: number
  convergenceScoreStable: boolean
  visualBBoxStable: boolean
  layoutQuiescent: boolean
  interactionIdle: boolean
  /** camera focus latch: (scoreStable ∧ layoutQuiescent) ∨ (visualBBox ∧ ¬layoutJobs)*/
  cameraReady: boolean
}

const pendingNodeActivationQueue: string[] = []
const queuedIds = new Set<string>()

let activeGraphNodeId: string | null = null
let nodeActivationRenderState: NodeActivationRenderState = 'IDLE'
let renderStabilityNodeId: string | null = null
let lastEmittedRenderStableScore = 0

const activeListeners = new Set<() => void>()
const renderStateListeners = new Set<() => void>()
const nodeActivatedListeners = new Set<(node: NoteGraphNode) => void>()
const nodeRenderStableListeners = new Set<(payload: NodeRenderStablePayload) => void>()

function notifyActiveListeners(): void {
  for (const fn of activeListeners) {
    fn()
  }
}

function notifyRenderStateListeners(): void {
  for (const fn of renderStateListeners) {
    fn()
  }
}

function setNodeActivationRenderState(next: NodeActivationRenderState): void {
  if (nodeActivationRenderState === next) return
  nodeActivationRenderState = next
  notifyRenderStateListeners()
}

function emitNodeActivated(node: NoteGraphNode): void {
  for (const fn of nodeActivatedListeners) {
    fn(node)
  }
}

function emitNodeRenderStable(payload: NodeRenderStablePayload): void {
  for (const fn of nodeRenderStableListeners) {
    fn(payload)
  }
}

function resetRenderStabilityTracker(): void {
  renderStabilityNodeId = null
  resetRenderConvergenceTracker()
  lastEmittedRenderStableScore = 0
}

function beginActivationRenderWatch(nodeId: string): void {
  resetRenderStabilityTracker()
  renderStabilityNodeId = nodeId
  setNodeActivationRenderState('ACTIVATING')
}

export function getNodeActivationRenderState(): NodeActivationRenderState {
  return nodeActivationRenderState
}

export function getLastRenderStableConvergenceScore(): number {
  return lastEmittedRenderStableScore
}

export function subscribeNodeActivationRenderState(listener: () => void): () => void {
  renderStateListeners.add(listener)
  return () => renderStateListeners.delete(listener)
}

/** GraphPanel: Report convergence samples per frame; hysteresis / visual quiescence → renderStable.*/
export function reportNodeRenderConvergenceFrame(sample: GraphRenderFrameSample): void {
  const nodeId = sample.nodeId
  if (!nodeId || activeGraphNodeId !== nodeId) return
  if (renderStabilityNodeId !== nodeId) return
  if (
    nodeActivationRenderState !== 'ACTIVATING' &&
    nodeActivationRenderState !== 'RENDER_PENDING'
  ) {
    return
  }

  if (nodeActivationRenderState === 'ACTIVATING') {
    setNodeActivationRenderState('RENDER_PENDING')
  }

  const { score, convergenceScoreStable, visualBBoxStable } =
    processRenderConvergenceFrame(sample)

  const layoutQuiescent = isGraphLayoutQuiescent()
  const interactionIdle = !isGraphInteracting()
  const noLayoutJobs = !hasPendingGraphLayoutJobs()

  const scorePath = convergenceScoreStable && layoutQuiescent
  const visualPath = visualBBoxStable && interactionIdle && noLayoutJobs

  if (!scorePath && !visualPath) return

  const payload: NodeRenderStablePayload = {
    nodeId,
    score,
    convergenceScoreStable,
    visualBBoxStable,
    layoutQuiescent,
    interactionIdle,
    cameraReady: scorePath || visualPath,
  }

  setNodeActivationRenderState('RENDER_STABLE')
  lastEmittedRenderStableScore = score
  emitNodeRenderStable(payload)
  resetRenderStabilityTracker()
  setNodeActivationRenderState('IDLE')
}

/** @deprecated using reportNodeRenderConvergenceFrame*/
export function reportNodeRenderFrame(
  nodeId: string,
  screenX: number,
  screenY: number,
): void {
  const box = { x: screenX - 10, y: screenY - 10, w: 20, h: 20 }
  reportNodeRenderConvergenceFrame({
    nodeId,
    screenX,
    screenY,
    edgeSegments: [],
    labelBox: box,
    visualBBox: box,
    transformMatrix: [1, 0, 0, 1, 0, 0],
  })
}

export function isNodeInCurrentSubgraph(nodeId: string): boolean {
  if (!nodeId) return false
  return getNoteGraphTopology().nodes.some((n) => n.id === nodeId)
}

function enqueueNodeActivation(nodeId: string): void {
  if (!nodeId || queuedIds.has(nodeId)) return
  queuedIds.add(nodeId)
  pendingNodeActivationQueue.push(nodeId)
}

function dequeueNodeActivation(nodeId: string): void {
  queuedIds.delete(nodeId)
  const idx = pendingNodeActivationQueue.indexOf(nodeId)
  if (idx >= 0) pendingNodeActivationQueue.splice(idx, 1)
}

/** Unified activation commit: Do not trigger camera, wait for render convergence.*/
export function commitActivation(nodeId: string): boolean {
  if (!nodeId) return false

  const node = getGraphNodeById(nodeId)
  if (!node) return false

  const layout = getPanelLayoutForType('graph')
  if (layout.width <= 0 || layout.height <= 0) return false

  dequeueNodeActivation(nodeId)
  setActiveGraphNodeId(nodeId)
  beginActivationRenderWatch(nodeId)
  emitNodeActivated(node)
  return true
}

/** Batch commit after subgraph/layout is ready.*/
export function flushPendingNodeActivationQueue(): void {
  if (pendingNodeActivationQueue.length === 0) return

  const layout = getPanelLayoutForType('graph')
  if (layout.width <= 0 || layout.height <= 0) return

  const pending = [...pendingNodeActivationQueue]
  for (const nodeId of pending) {
    if (!isNodeInCurrentSubgraph(nodeId)) continue
    commitActivation(nodeId)
  }
}

export function getActiveGraphNodeId(): string | null {
  return activeGraphNodeId
}

/** activeGraphNodeId SSOT: All activation writes must go through this entry.*/
export function setActiveGraphNodeId(nodeId: string | null): void {
  const changed = activeGraphNodeId !== nodeId
  activeGraphNodeId = nodeId
  if (!nodeId) {
    resetRenderStabilityTracker()
    setNodeActivationRenderState('IDLE')
  }
  if (changed) {
    notifyActiveListeners()
  }
}

export function getPendingNodeActivationQueue(): readonly string[] {
  return pendingNodeActivationQueue
}

export function activateGraphNode(nodeId: string): boolean {
  if (!nodeId) return false

  if (!isNodeInCurrentSubgraph(nodeId)) {
    enqueueNodeActivation(nodeId)
    ensureNodeInRenderedSubgraph(nodeId)
    return false
  }

  return commitActivation(nodeId)
}

export function requestNodeActivation(nodeId: string): void {
  if (!nodeId) return
  enqueueNodeActivation(nodeId)
  if (!isNodeInCurrentSubgraph(nodeId)) {
    ensureNodeInRenderedSubgraph(nodeId)
  }
}

export function activateGraphNodeForDocKey(docKey: string): boolean {
  const node = getGraphNodeByDocKey(docKey)
  const nodeId = node?.id ?? `page:${docKey}`
  return activateGraphNode(nodeId)
}

export function subscribeActiveGraphNode(listener: () => void): () => void {
  activeListeners.add(listener)
  return () => activeListeners.delete(listener)
}

export function subscribeNodeActivated(
  listener: (node: NoteGraphNode) => void,
): () => void {
  nodeActivatedListeners.add(listener)
  return () => nodeActivatedListeners.delete(listener)
}

export function subscribeNodeRenderStable(
  listener: (payload: NodeRenderStablePayload) => void,
): () => void {
  nodeRenderStableListeners.add(listener)
  return () => nodeRenderStableListeners.delete(listener)
}

export function resetGraphNodeActivationRuntime(): void {
  pendingNodeActivationQueue.length = 0
  queuedIds.clear()
  resetRenderStabilityTracker()
  nodeActivationRenderState = 'IDLE'
  activeGraphNodeId = null
  activeListeners.clear()
  renderStateListeners.clear()
  nodeActivatedListeners.clear()
  nodeRenderStableListeners.clear()
}
