/**
 * Graph Viewport Kernel — The pan/zoom is owned by the runtime; the viewport center is only driven explicitly by the route.
 */
import type { DocKey } from '../knowledgeRuntime/types'
import { getCurrentOSKernelTick, type OSKernelTickId } from './osKernelClock'
import { recordGraphZoomFrame } from './layout/graphViewportProfile'
import { requestGraphViewportOsInvalidation } from './graphViewportOsBinding'
import {
  getGraphCameraLockPhase,
  onAutoViewportBoundsCentered,
  resetGraphCameraLock,
  shouldAllowAutoViewportCenter,
  shouldAllowExplicitViewportCenter,
  shouldAllowNavigationViewportCenter,
} from './graphCameraLock'
import { markLayoutPhysicsActivity } from './graphLayoutPhysicsHeartbeat'
import { computeGraphBounds } from './layout/graphBounds'
import { shouldSuppressAutoGraphViewportCenter } from './graphViewportFocusRuntime'
import { getPanelLayoutForType } from './surfaceLayoutRuntime'

export type GraphViewportCenterSource = 'auto' | 'explicit' | 'navigation'

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type GraphViewportNodeBounds = {
  x: number
  y: number
}

export type GraphViewportIntent =
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'zoom'; factor: number }
  | { kind: 'set'; viewport: GraphViewport }
  | {
      kind: 'centerOnBounds'
      center: GraphViewportNodeBounds
      width: number
      height: number
    }
  | { kind: 'reset' }

export type GraphViewportSnapshot = {
  kernelTick: OSKernelTickId
  revision: number
  viewport: GraphViewport
  routeCenterDocKey: DocKey | null
  layoutWidth: number
  layoutHeight: number
}

const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.5

let liveViewport: GraphViewport = { x: 0, y: 0, zoom: 1 }
let liveRouteCenterDocKey: DocKey | null = null
let viewportRevision = 0

const viewportByTick = new Map<OSKernelTickId, GraphViewportSnapshot>()
const listeners = new Set<() => void>()

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
}

/** pan/zoom: UI subscribers only, does not bump OS kernel.*/
function notifyViewportUi(): void {
  viewportRevision += 1
  for (const fn of listeners) {
    fn()
  }
}

/** route center/set/reset: synchronize OS snapshot.*/
function notifyViewportCommitted(): void {
  notifyViewportUi()
  requestGraphViewportOsInvalidation()
}

function recordViewportAtTick(tick: OSKernelTickId): void {
  const layout = getPanelLayoutForType('graph', tick)
  viewportByTick.set(tick, {
    kernelTick: tick,
    revision: viewportRevision,
    viewport: { ...liveViewport },
    routeCenterDocKey: liveRouteCenterDocKey,
    layoutWidth: layout.width,
    layoutHeight: layout.height,
  })
}

/**
 * Centers the map geometry at the center of the viewport (only translates, does not change zoom).
 */
export function computeViewportCenterOnPoint(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  zoom: number,
): GraphViewport {
  if (width <= 0 || height <= 0) {
    return { ...liveViewport }
  }
  const z = clampZoom(zoom)
  // GraphPanel applies translate(x + width/2, y + height/2) scale(z); pan is NOT pre-offset by half size.
  return {
    x: -centerX * z,
    y: -centerY * z,
    zoom: z,
  }
}

/** @deprecated using computeViewportCenterOnPoint*/
export function computeViewportCenterOnNode(
  node: GraphViewportNodeBounds,
  width: number,
  height: number,
  zoom: number,
): GraphViewport {
  return computeViewportCenterOnPoint(node.x, node.y, width, height, zoom)
}

/** @deprecated Test/compatibility only; use centerOn intent for production paths.*/
export function computeDeterministicFitView(
  nodes: readonly GraphViewportNodeBounds[],
  width: number,
  height: number,
  padding = 48,
): GraphViewport {
  if (nodes.length === 0 || width <= 0 || height <= 0) {
    return { x: 0, y: 0, zoom: 1 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y)
  }

  const graphW = Math.max(maxX - minX, 1)
  const graphH = Math.max(maxY - minY, 1)
  const innerW = Math.max(width - padding * 2, 1)
  const innerH = Math.max(height - padding * 2, 1)
  const zoom = clampZoom(Math.min(innerW / graphW, innerH / graphH))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return {
    x: -cx * zoom,
    y: -cy * zoom,
    zoom,
  }
}

export const GRAPH_ZOOM_STEP = 1.12

export function fitGraphViewToNodes(
  nodes: readonly GraphViewportNodeBounds[],
  width: number,
  height: number,
  padding = 48,
): GraphViewport {
  if (nodes.length === 0 || width <= 0 || height <= 0) {
    return resetGraphViewToDefault()
  }
  return setGraphViewportIntent({
    kind: 'set',
    viewport: computeDeterministicFitView(nodes, width, height, padding),
  })
}

export function resetGraphViewToDefault(): GraphViewport {
  return setGraphViewportIntent({ kind: 'reset' })
}

export function zoomGraphViewByFactor(factor: number): GraphViewport {
  return setGraphViewportIntent({ kind: 'zoom', factor })
}

export function resetGraphViewportRuntime(): void {
  liveViewport = { x: 0, y: 0, zoom: 1 }
  liveRouteCenterDocKey = null
  viewportRevision = 0
  viewportByTick.clear()
  listeners.clear()
  resetGraphCameraLock()
}

export function subscribeGraphViewport(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGraphViewportRevision(): number {
  return viewportRevision
}

/** Translate the viewport to the center of the atlas bounding box (without triggering layout).*/
export function centerGraphOnBoundsCenter(
  nodes: readonly GraphViewportNodeBounds[],
  width: number,
  height: number,
  source: GraphViewportCenterSource = 'auto',
): GraphViewport | null {
  if (source === 'auto' && !shouldAllowAutoViewportCenter()) return null
  if (source === 'auto' && shouldSuppressAutoGraphViewportCenter()) return null
  if (source === 'explicit' && !shouldAllowExplicitViewportCenter()) return null

  const bounds = computeGraphBounds(nodes)
  if (!bounds || width <= 0 || height <= 0) return null

  const viewport = setGraphViewportIntent({
    kind: 'centerOnBounds',
    center: { x: bounds.centerX, y: bounds.centerY },
    width,
    height,
  })

  if (source === 'auto') {
    onAutoViewportBoundsCentered()
  }

  return viewport
}

/** Navigation: Roughly center the node (or subgraph range) corresponding to docKey.*/
export function centerGraphOnDoc(
  docKey: DocKey,
  nodes: readonly (GraphViewportNodeBounds & { docKey?: DocKey })[],
  width: number,
  height: number,
): GraphViewport | null {
  const docNode = nodes.find((n) => n.docKey === docKey)
  if (docNode) {
    return centerGraphOnNode({ x: docNode.x, y: docNode.y }, width, height, 'navigation')
  }
  if (nodes.length === 0 || width <= 0 || height <= 0) return null
  return centerGraphOnBoundsCenter(nodes, width, height, 'navigation')
}

/** navigation/backlink: Center the specified node in the viewport (highest priority, bypasses STABLE).*/
export function centerGraphOnNode(
  node: GraphViewportNodeBounds,
  width: number,
  height: number,
  source: GraphViewportCenterSource = 'navigation',
): GraphViewport | null {
  if (source === 'navigation' && !shouldAllowNavigationViewportCenter()) return null
  if (width <= 0 || height <= 0) return null

  return setGraphViewportIntent({
    kind: 'centerOnBounds',
    center: { x: node.x, y: node.y },
    width,
    height,
  })
}

/** Explicit "re-centering" by the user; only takes effect during the camera STABLE phase.*/
export function requestExplicitGraphRecenter(
  nodes: readonly GraphViewportNodeBounds[],
  width: number,
  height: number,
): GraphViewport | null {
  return centerGraphOnBoundsCenter(nodes, width, height, 'explicit')
}

/** @deprecated use centerGraphOnBoundsCenter; route only for highlight*/
export function centerGraphOnRouteNode(
  _routeDocKey: DocKey,
  node: GraphViewportNodeBounds,
  width: number,
  height: number,
): GraphViewport {
  return setGraphViewportIntent({
    kind: 'centerOnBounds',
    center: { x: node.x, y: node.y },
    width,
    height,
  })
}

export function setGraphViewportIntent(
  intent: GraphViewportIntent,
  kernelTick?: OSKernelTickId,
): GraphViewport {
  const prev = liveViewport

  switch (intent.kind) {
    case 'pan':
      liveViewport = { ...prev, x: prev.x + intent.dx, y: prev.y + intent.dy }
      if (getGraphCameraLockPhase() === 'STABILIZING') {
        markLayoutPhysicsActivity('transform-pan')
      }
      break
    case 'zoom':
      liveViewport = { ...prev, zoom: clampZoom(prev.zoom * intent.factor) }
      break
    case 'set':
      liveViewport = {
        x: intent.viewport.x,
        y: intent.viewport.y,
        zoom: clampZoom(intent.viewport.zoom),
      }
      break
    case 'centerOnBounds':
      liveViewport = computeViewportCenterOnPoint(
        intent.center.x,
        intent.center.y,
        intent.width,
        intent.height,
        prev.zoom,
      )
      break
    case 'reset':
      liveViewport = { x: 0, y: 0, zoom: 1 }
      liveRouteCenterDocKey = null
      break
  }

  const tick = kernelTick ?? getCurrentOSKernelTick()
  recordViewportAtTick(tick)

  const isPreviewOnly = intent.kind === 'pan' || intent.kind === 'zoom'
  if (isPreviewOnly) {
    notifyViewportUi()
    recordGraphZoomFrame(false)
  } else {
    notifyViewportCommitted()
    recordGraphZoomFrame(true)
  }

  return { ...liveViewport }
}

export function projectGraphViewportAtTick(tick: OSKernelTickId): GraphViewport {
  const direct = viewportByTick.get(tick)
  if (direct) return { ...direct.viewport }

  let bestTick = -1
  let best: GraphViewport | null = null
  for (const [t, snap] of viewportByTick) {
    if (t <= tick && t >= bestTick) {
      bestTick = t
      best = snap.viewport
    }
  }
  return best ? { ...best } : { ...liveViewport }
}

export function getGraphViewport(kernelTick?: OSKernelTickId): GraphViewport {
  return projectGraphViewportAtTick(kernelTick ?? getCurrentOSKernelTick())
}

export function getGraphViewportSnapshot(kernelTick?: OSKernelTickId): GraphViewportSnapshot {
  const tick = kernelTick ?? getCurrentOSKernelTick()
  const layout = getPanelLayoutForType('graph', tick)
  return {
    kernelTick: tick,
    revision: viewportRevision,
    viewport: getGraphViewport(tick),
    routeCenterDocKey: liveRouteCenterDocKey,
    layoutWidth: layout.width,
    layoutHeight: layout.height,
  }
}
