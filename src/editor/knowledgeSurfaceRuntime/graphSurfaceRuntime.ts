import {
  buildContextGraphIncremental,
  scheduleContextGraphUpdate,
  getVisibleContextNodes,
  type ContextGraphSnapshot,
} from '../knowledgeInteractionRuntime'
import { registerSurfaceRecord, transitionSurfacePhase } from './surfaceLifecycle'
import { scheduleSurfaceTask, cancelSurfaceTasksByPrefix } from './surfaceScheduler'
import { computeVirtualWindow, virtualizeSurface } from './surfaceVirtualization'
import { getGraphPanelLayout } from '../knowledgeOS/graphPanelLayoutRuntime'
import {
  getGraphViewport,
  setGraphViewportIntent,
} from '../knowledgeOS/graphViewportRuntime'
import type { DocKey } from '../knowledgeRuntime/types'

function resolveGraphSurfaceSize(width?: number, height?: number): { width: number; height: number } {
  const layout = getGraphPanelLayout()
  return {
    width: width ?? (layout.width > 0 ? layout.width : 800),
    height: height ?? (layout.height > 0 ? layout.height : 600),
  }
}

export type GraphSurfaceSnapshot = {
  surfaceId: string
  centerDocKey: DocKey
  revision: number
  graph: ContextGraphSnapshot
  visibleNodeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  focusMode: boolean
}

const snapshots = new Map<string, GraphSurfaceSnapshot>()
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeGraphSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function mountGraphSurface(centerDocKey: DocKey, width?: number, height?: number): string {
  const { width: w, height: h } = resolveGraphSurfaceSize(width, height)
  const surfaceId = `graph-${centerDocKey}`
  registerSurfaceRecord(surfaceId, 'graph-panel', { docKey: centerDocKey })
  transitionSurfacePhase(surfaceId, 'visible')
  scheduleGraphSurfaceUpdate(surfaceId, centerDocKey, w, h)
  return surfaceId
}

export function scheduleGraphSurfaceUpdate(
  surfaceId: string,
  centerDocKey: DocKey,
  width?: number,
  height?: number,
): void {
  const { width: w, height: h } = resolveGraphSurfaceSize(width, height)
  cancelSurfaceTasksByPrefix(`graph-surface:${centerDocKey}`)
  scheduleSurfaceTask({
    key: `graph-surface:${centerDocKey}`,
    kind: 'graph',
    priority: 'background',
    run: () => {
      scheduleContextGraphUpdate(centerDocKey, (graph) => {
        const viewport = getGraphViewport()
        const visible = getVisibleContextNodes(graph, w, h, viewport)
        const win = computeVirtualWindow(0, 1, h, graph.nodes.length, 20)
        virtualizeSurface(surfaceId, win)

        snapshots.set(surfaceId, {
          surfaceId,
          centerDocKey,
          revision: (snapshots.get(surfaceId)?.revision ?? 0) + 1,
          graph,
          visibleNodeIds: visible.map((n) => n.id),
          viewport,
          focusMode: graph.focusMode,
        })
        notify()
      })
    },
  })
}

export function getGraphSurfaceSnapshot(surfaceId: string): GraphSurfaceSnapshot | null {
  return snapshots.get(surfaceId) ?? null
}

export function updateGraphSurfaceViewport(
  surfaceId: string,
  viewport: { x: number; y: number; zoom: number },
  width?: number,
  height?: number,
): void {
  const { width: w, height: h } = resolveGraphSurfaceSize(width, height)
  setGraphViewportIntent({ kind: 'set', viewport })
  const snap = snapshots.get(surfaceId)
  if (!snap) return
  const visible = getVisibleContextNodes(snap.graph, w, h, viewport)
  snapshots.set(surfaceId, {
    ...snap,
    viewport,
    visibleNodeIds: visible.map((n) => n.id),
    revision: snap.revision + 1,
  })
  notify()
}

export function getContextualGraphSnapshot(centerDocKey: DocKey): ContextGraphSnapshot {
  return buildContextGraphIncremental(centerDocKey)
}

export function resetGraphSurfaceRuntime(): void {
  snapshots.clear()
  listeners.clear()
}
