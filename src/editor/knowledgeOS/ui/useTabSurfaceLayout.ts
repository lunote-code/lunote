import { useEffect } from 'react'
import { getCurrentOSKernelTick } from '../osKernelClock'
import { isSurfaceSplitDragging } from '../layout/surfaceSplitLayoutRuntime'
import { profileLayoutRecalc } from '../layout/surfaceSplitLayoutProfile'
import {
  reportTabSurfaceLayout,
  type SurfacePanelType,
} from '../surfaceLayoutRuntime'
import { invalidateKnowledgeOSSnapshot } from '../knowledgeUIBridge'
import type { KnowledgeRailTab } from './KnowledgeTabs'

function tabToPanelType(tab: KnowledgeRailTab): SurfacePanelType {
  return tab === 'graph' ? 'graph' : 'backlink'
}

/**
 * Tab surface is layout host: measure tab root and active panel, write surfaceLayout.tab.
 * Disable auto-fit / viewport center side effects.
 */
export function useTabSurfaceLayout(
  activeTab: KnowledgeRailTab,
  tabRootRef: React.RefObject<HTMLElement | null>,
  tabPanelRef: React.RefObject<HTMLElement | null>,
): void {
  const activePanel = tabToPanelType(activeTab)

  useEffect(() => {
    const rootEl = tabRootRef.current
    const panelEl = tabPanelRef.current
    if (!rootEl || !panelEl) return

    const measure = () => {
      if (isSurfaceSplitDragging()) return
      profileLayoutRecalc('tab', 'measure')
      const rootRect = rootEl.getBoundingClientRect()
      const panelRect = panelEl.getBoundingClientRect()
      const changed = reportTabSurfaceLayout(
        {
          tabContainerRect: { width: rootRect.width, height: rootRect.height },
          activePanel,
          activePanelRect: { width: panelRect.width, height: panelRect.height },
        },
        getCurrentOSKernelTick(),
      )
      if (changed) {
        invalidateKnowledgeOSSnapshot()
      }
    }

    measure()
    // RDP / VPS: first layout pass may report 0×0 before flex chain settles.
    const raf1 = requestAnimationFrame(() => {
      measure()
      requestAnimationFrame(measure)
    })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') measure()
    }
    window.addEventListener('focus', measure)
    document.addEventListener('visibilitychange', onVisibility)

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => {
        cancelAnimationFrame(raf1)
        window.removeEventListener('resize', measure)
        window.removeEventListener('focus', measure)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }

    const ro = new ResizeObserver(() => measure())
    ro.observe(rootEl)
    ro.observe(panelEl)
    return () => {
      cancelAnimationFrame(raf1)
      ro.disconnect()
      window.removeEventListener('focus', measure)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [activeTab, activePanel, tabRootRef, tabPanelRef])
}
