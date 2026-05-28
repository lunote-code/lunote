import type { DocKey } from '../knowledgeRuntime/types'
import { overrideCameraLockForNavigationBurst } from './graphCameraLock'
import { getGraphNodeById } from './graphIndex'
import { subscribeNodeRenderStable } from './graphNodeActivationRuntime'
import {
  beginGraphNavigationReadiness,
  isGraphReady,
  subscribeGraphReadiness,
} from './graphReadinessRuntime'
import { getNoteGraphTopology } from './noteGraphRuntime'
import { getPanelLayoutForType } from './surfaceLayoutRuntime'
import { preserveViewportBasis } from './graphViewportFocusRuntime'
import { centerGraphOnBoundsCenter, centerGraphOnNode, getGraphViewport } from './graphViewportRuntime'
import type { NoteGraphNode } from './types'

export type PendingGraphCenter = {
  docKey: DocKey
  nodeId: string
}

const PENDING_FLUSH_WARN_MS = 2000

let pendingGraphCenter: PendingGraphCenter | null = null
let pendingFlushWarnTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingFlushWarnTimer(): void {
  if (pendingFlushWarnTimer != null) {
    clearTimeout(pendingFlushWarnTimer)
    pendingFlushWarnTimer = null
  }
}

function schedulePendingFlushWarn(): void {
  clearPendingFlushWarnTimer()
  pendingFlushWarnTimer = setTimeout(() => {
    pendingFlushWarnTimer = null
    if (pendingGraphCenter) {
      console.warn('[Graph] pending center not flushed - readiness delay')
    }
  }, PENDING_FLUSH_WARN_MS)
}

/** A. Doc-level coarse positioning (excluding node highlighting/fine focusing).*/
export function applyNavigationCoarseCenter(
  pending: PendingGraphCenter,
  nodes: readonly NoteGraphNode[],
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false

  const docNeighbors = nodes.filter(
    (n) => n.docKey === pending.docKey || n.id === pending.nodeId,
  )
  const graphScope = docNeighbors.length > 0 ? docNeighbors : nodes
  if (graphScope.length === 0) return false

  overrideCameraLockForNavigationBurst(1)
  centerGraphOnBoundsCenter(graphScope, width, height, 'navigation')
  return true
}

/** B. node fine focus; only called after render stable; retain the current zoom and only adjust pan.*/
export function centerCameraOnNodeForActivation(
  node: NoteGraphNode,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return false

  const basis = preserveViewportBasis()
  const zoom = basis.zoom
  const nextX = width / 2 - node.x * zoom
  const nextY = height / 2 - node.y * zoom

  if (import.meta.env.DEV) {
    const current = getGraphViewport()
    console.debug('[GraphViewport]', {
      currentTransform: current,
      nextTransform: { x: nextX, y: nextY, zoom },
      preserveZoom: true,
      node: { x: node.x, y: node.y },
    })
  }

  overrideCameraLockForNavigationBurst(1)
  centerGraphOnNode({ x: node.x, y: node.y }, width, height, 'navigation')
  return true
}

/** @deprecated uses applyNavigationCoarseCenter; fine focusing is responsible for commitActivation*/
export function applyNavigationGraphFocus(
  pending: PendingGraphCenter,
  nodes: readonly NoteGraphNode[],
  width: number,
  height: number,
): boolean {
  return applyNavigationCoarseCenter(pending, nodes, width, height)
}

function attemptCoarseCenterFlush(
  nodes?: readonly NoteGraphNode[],
  width?: number,
  height?: number,
  options?: { force?: boolean },
): boolean {
  if (!pendingGraphCenter) return false
  if (!options?.force && !isGraphReady()) return false

  const layout = getPanelLayoutForType('graph')
  const w = width ?? layout.width
  const h = height ?? layout.height
  const topoNodes = nodes ?? getNoteGraphTopology().nodes

  const ok = applyNavigationCoarseCenter(pendingGraphCenter, topoNodes, w, h)
  if (ok) {
    clearPendingGraphCenter()
  }
  return ok
}

subscribeGraphReadiness(() => {
  attemptCoarseCenterFlush(undefined, undefined, undefined, { force: false })
})

export function setPendingGraphCenter(docKey: DocKey, nodeId: string): void {
  const resolvedNodeId = nodeId || `page:${docKey}`
  pendingGraphCenter = { docKey, nodeId: resolvedNodeId }
  beginGraphNavigationReadiness()
  schedulePendingFlushWarn()
}

export function getPendingGraphCenter(): PendingGraphCenter | null {
  return pendingGraphCenter
}

export function clearPendingGraphCenter(): void {
  pendingGraphCenter = null
  clearPendingFlushWarnTimer()
}

export function flushPendingGraphCenterWhenReady(
  nodes: readonly NoteGraphNode[],
  width: number,
  height: number,
): boolean {
  return attemptCoarseCenterFlush(nodes, width, height, { force: false })
}

export function flushPendingGraphNavigationCenter(
  nodes: readonly NoteGraphNode[],
  width: number,
  height: number,
): boolean {
  return attemptCoarseCenterFlush(nodes, width, height, { force: true })
}

/** @deprecated use flushPendingGraphNavigationCenter*/
export function tryApplyPendingGraphNavigationCenter(
  nodes: readonly NoteGraphNode[],
  width: number,
  height: number,
): boolean {
  return flushPendingGraphNavigationCenter(nodes, width, height)
}

export function resetGraphNavigationRuntime(): void {
  pendingGraphCenter = null
  clearPendingFlushWarnTimer()
}

/** Stage B fine focus: hysteresis stable ∨ visual bbox quiescence, and layout is silent.*/
subscribeNodeRenderStable((payload) => {
  if (!payload.cameraReady) return

  const node = getGraphNodeById(payload.nodeId)
  if (!node) return
  const layout = getPanelLayoutForType('graph')
  if (layout.width <= 0 || layout.height <= 0) return
  centerCameraOnNodeForActivation(node, layout.width, layout.height)
})
