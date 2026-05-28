import { useEffect, useState } from 'react'
import {
  getKnowledgeOSSnapshot,
  invalidateKnowledgeOSSnapshot,
  subscribeKnowledgeOSSnapshot,
} from '../knowledgeUIBridge'
import {
  getCurrentOSKernelTick,
  type OSKernelTickId,
} from '../osKernelClock'
import { isSurfaceResizing } from '../layout/surfaceSplitLayoutRuntime'
import { profileLayoutRecalc } from '../layout/surfaceSplitLayoutProfile'
import {
  getPanelLayoutForType,
  reportPanelContainerRect,
  type PanelLayoutRect,
  type SurfacePanelType,
} from '../surfaceLayoutRuntime'

function useOsKernelTick(): OSKernelTickId {
  const [tick, setTick] = useState(() => getKnowledgeOSSnapshot().revision)
  useEffect(() => {
    return subscribeKnowledgeOSSnapshot(() => {
      setTick(getKnowledgeOSSnapshot().revision)
    })
  }, [])
  return tick
}

/**
 * graph/backlink: dimensions from surfaceLayout.tab (Tab surface host measurement).
 * search: still reported by the ResizeObserver of this hook.
 */
export function useSurfaceLayout(
  panelType: SurfacePanelType,
  containerRef: React.RefObject<HTMLElement | null>,
): PanelLayoutRect {
  const kernelTick = useOsKernelTick()
  const tabHosted = panelType === 'graph' || panelType === 'backlink'

  useEffect(() => {
    if (tabHosted) return

    const el = containerRef.current
    if (!el) return

    const measure = () => {
      if (isSurfaceResizing()) return
      profileLayoutRecalc('graph', panelType)
      const rect = el.getBoundingClientRect()
      const changed = reportPanelContainerRect(
        panelType,
        { width: rect.width, height: rect.height },
        getCurrentOSKernelTick(),
      )
      if (changed) invalidateKnowledgeOSSnapshot()
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [panelType, containerRef, kernelTick, tabHosted])

  void kernelTick
  return getPanelLayoutForType(panelType, getCurrentOSKernelTick())
}
