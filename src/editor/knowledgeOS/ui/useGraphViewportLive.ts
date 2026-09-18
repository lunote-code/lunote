import { useEffect, useRef, useState } from 'react'
import { notifyGraphTopologyRevisionChanged, shouldAllowAutoViewportCenter } from '../graphCameraLock'
import { hasPendingGraphLayoutJobs } from '../graphLayoutDependencyRuntime'
import { markLayoutPhysicsIfNodePositionsChanged } from '../graphLayoutPhysicsHeartbeat'
import { buildGraphFitNodeBounds, measureGraphFitBoundsSpan, measureGraphNodeCenterSpan } from '../layout/graphFitBounds'
import { isNoteGraphOnFallbackLayout } from '../noteGraphRuntime'
import {
  autoFitGraphViewportOnBoot,
  fitGraphViewToNodes,
  getGraphPanelMountGeneration,
  getGraphViewport,
  subscribeGraphViewport,
  type GraphViewport,
} from '../graphViewportRuntime'
import type { NoteGraphNode } from '../types'

/** Match useHostLayoutFallback — skip auto-center until the panel has a real size (Windows first paint). */
const MIN_TRUSTED_LAYOUT_PX = 48
/** Skip fit while node centers still overlap (pre-layout); avoids clamping zoom to ZOOM_MAX. */
const MIN_NODE_CENTER_SPAN_PX = 28
const MIN_BOUNDS_DELTA_FOR_REFIT_PX = 12

type LayoutSize = {
  width: number
  height: number
}

function nodeLayoutKey(nodes: readonly NoteGraphNode[]): string {
  return nodes.map((n) => `${n.id}:${Math.round(n.x)}:${Math.round(n.y)}`).join('\n')
}

/**
 * Viewport: bbox is centered once in the BOOT stage; STABILIZING requires revision + physical layout double silence;
 * Only explicit recenter movable center after STABLE.
 */
export function useGraphViewportLive(
  nodes: readonly NoteGraphNode[],
  layout: LayoutSize,
  topologyRevision: number,
): GraphViewport {
  const [viewport, setViewport] = useState<GraphViewport>(() => getGraphViewport())
  const prevNodeBoundsRef = useRef<readonly { x: number; y: number }[]>([])
  const lastFitLayoutRef = useRef<LayoutSize>({ width: 0, height: 0 })
  const lastFitBoundsSpanRef = useRef(0)
  const lastPanelMountGenRef = useRef(-1)
  const pendingViewportRef = useRef<GraphViewport | null>(null)
  const rafRef = useRef<number>(0)
  const layoutKey = nodeLayoutKey(nodes)

  const layoutSizeChanged = (prev: LayoutSize, next: LayoutSize): boolean => {
    if (prev.width <= 0 || prev.height <= 0) return true
    return Math.abs(next.width - prev.width) > 12 || Math.abs(next.height - prev.height) > 12
  }

  useEffect(() => {
    const flush = () => {
      rafRef.current = 0
      const next = pendingViewportRef.current
      pendingViewportRef.current = null
      if (!next) return
      setViewport(next)
    }
    const unsubscribe = subscribeGraphViewport(() => {
      pendingViewportRef.current = getGraphViewport()
      if (rafRef.current !== 0) return
      rafRef.current = requestAnimationFrame(flush)
    })
    return () => {
      unsubscribe()
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      pendingViewportRef.current = null
    }
  }, [])

  useEffect(() => {
    if (
      layout.width < MIN_TRUSTED_LAYOUT_PX ||
      layout.height < MIN_TRUSTED_LAYOUT_PX ||
      nodes.length === 0
    ) {
      return
    }

    const nodeBounds = nodes.map((n) => ({ x: n.x, y: n.y }))
    const fitNodes = buildGraphFitNodeBounds(nodes)
    const centerSpan = measureGraphNodeCenterSpan(nodes)
    const boundsSpan = measureGraphFitBoundsSpan(fitNodes)
    const panelMountChanged = getGraphPanelMountGeneration() !== lastPanelMountGenRef.current
    markLayoutPhysicsIfNodePositionsChanged(prevNodeBoundsRef.current, nodeBounds)
    prevNodeBoundsRef.current = nodeBounds

    if (isNoteGraphOnFallbackLayout() || hasPendingGraphLayoutJobs()) {
      notifyGraphTopologyRevisionChanged(topologyRevision)
      return
    }

    if (nodes.length > 1 && centerSpan < MIN_NODE_CENTER_SPAN_PX) {
      notifyGraphTopologyRevisionChanged(topologyRevision)
      return
    }

    const layoutChanged = layoutSizeChanged(lastFitLayoutRef.current, layout)
    const boundsChanged =
      Math.abs(boundsSpan - lastFitBoundsSpanRef.current) >= MIN_BOUNDS_DELTA_FOR_REFIT_PX

    if (!layoutChanged && !boundsChanged && !panelMountChanged) {
      notifyGraphTopologyRevisionChanged(topologyRevision)
      return
    }

    lastFitLayoutRef.current = { width: layout.width, height: layout.height }
    lastFitBoundsSpanRef.current = boundsSpan
    lastPanelMountGenRef.current = getGraphPanelMountGeneration()

    if (shouldAllowAutoViewportCenter()) {
      autoFitGraphViewportOnBoot(fitNodes, layout.width, layout.height)
    } else if (layoutChanged || panelMountChanged) {
      // Post-boot: refit on panel resize/remount only — not on force-layout bounds churn (preserves pan).
      fitGraphViewToNodes(fitNodes, layout.width, layout.height)
    }
    notifyGraphTopologyRevisionChanged(topologyRevision)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout/nodes objects are recreated each render; width/height/layoutKey cover changes
  }, [topologyRevision, layout.width, layout.height, layoutKey, nodes.length])

  return viewport
}
