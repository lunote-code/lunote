import { useEffect, useRef, useState } from 'react'
import { notifyGraphTopologyRevisionChanged } from '../graphCameraLock'
import { markLayoutPhysicsIfNodePositionsChanged } from '../graphLayoutPhysicsHeartbeat'
import {
  centerGraphOnBoundsCenter,
  getGraphViewport,
  subscribeGraphViewport,
  type GraphViewport,
} from '../graphViewportRuntime'
import type { NoteGraphNode } from '../types'

/** Match useHostLayoutFallback — skip auto-center until the panel has a real size (Windows first paint). */
const MIN_TRUSTED_LAYOUT_PX = 48

type LayoutSize = {
  width: number
  height: number
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
  const pendingViewportRef = useRef<GraphViewport | null>(null)
  const rafRef = useRef<number>(0)

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
    markLayoutPhysicsIfNodePositionsChanged(prevNodeBoundsRef.current, nodeBounds)
    prevNodeBoundsRef.current = nodeBounds

    centerGraphOnBoundsCenter(nodeBounds, layout.width, layout.height, 'auto')
    notifyGraphTopologyRevisionChanged(topologyRevision)
  }, [topologyRevision, layout.width, layout.height, nodes])

  return viewport
}
