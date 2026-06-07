import { useLayoutEffect, type RefObject } from 'react'

import {
  clearGraphFontReflowQueued,
  markGraphFontReflowQueued,
} from '../graphLayoutDependencyRuntime'
import {
  buildGraphRenderFrameSample,
} from '../graphRenderConvergence'
import {
  getNodeActivationRenderState,
  reportNodeRenderConvergenceFrame,
} from '../graphNodeActivationRuntime'
import type { NoteGraphEdge, NoteGraphNode } from '../types'

type Viewport = {
  x: number
  y: number
  zoom: number
}

/** SVG layer: Collect convergence samples, hysteresis / visual quiescence → renderStable.*/
export function useGraphNodeRenderStability(
  activeNodeId: string | null,
  renderState: ReturnType<typeof getNodeActivationRenderState>,
  nodes: readonly NoteGraphNode[],
  edges: readonly NoteGraphEdge[],
  viewport: Viewport,
  width: number,
  height: number,
  worldGroupRef: RefObject<SVGGElement | null>,
  graphRevision: number,
): void {
  useLayoutEffect(() => {
    if (graphRevision > 0) {
      markGraphFontReflowQueued()
    }
  }, [graphRevision])

  useLayoutEffect(() => {
    if (!activeNodeId) return
    if (renderState !== 'ACTIVATING' && renderState !== 'RENDER_PENDING') return

    let cancelled = false
    let raf = 0

    const tick = () => {
      if (cancelled) return

      const sample = buildGraphRenderFrameSample(
        activeNodeId,
        nodes,
        edges,
        viewport,
        width,
        height,
        worldGroupRef.current,
      )
      if (sample) {
        clearGraphFontReflowQueued()
        reportNodeRenderConvergenceFrame(sample)
      }

      const next = getNodeActivationRenderState()
      if (!cancelled && (next === 'ACTIVATING' || next === 'RENDER_PENDING')) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [
    activeNodeId,
    renderState,
    nodes,
    edges,
    viewport,
    width,
    height,
    worldGroupRef,
    graphRevision,
  ])
}
