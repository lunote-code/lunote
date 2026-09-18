import { useCallback, useEffect, useRef } from 'react'
import {
  applyKosRailWidthCss,
  beginSurfaceSplitDrag,
  clearKosRailWidthInline,
  commitSurfaceSplitLayout,
  getSurfaceSplitLayout,
  isSurfaceSplitDragging,
  reportMainSplitAreaWidth,
  setSurfaceSplitPreview,
  subscribeSurfaceSplitLayout,
  setSurfaceSplitLayoutProgrammatic,
  SURFACE_RAIL_DEFAULT_PX,
  SURFACE_RAIL_MAX_PX,
  SURFACE_RAIL_MIN_PX,
  SURFACE_SPLITTER_WIDTH_PX,
} from '../layout/surfaceSplitLayoutRuntime'
import {
  beginDeepProfileDrag,
  endDeepProfileDrag,
  profileLayoutRecalc,
} from '../layout/surfaceSplitLayoutProfile'
import { beginVerticalSplitDrag } from '../../../lib/verticalSplitDrag'
import { invalidateKnowledgeOSSnapshot } from '../knowledgeUIBridge'
import { getCurrentOSKernelTick } from '../osKernelClock'

const RESIZE_DEBOUNCE_MS = 200

function clampRailWidth(nextRail: number, usable: number): number {
  const maxRail = Math.min(SURFACE_RAIL_MAX_PX, Math.max(SURFACE_RAIL_MIN_PX, usable - SURFACE_RAIL_MIN_PX))
  return Math.max(SURFACE_RAIL_MIN_PX, Math.min(maxRail, Math.round(nextRail)))
}

export function useSurfaceSplitLayout(
  mainRef: React.RefObject<HTMLElement | null>,
  railVisible: boolean,
) {
  const committedRailWidthRef = useRef(
    railVisible ? getSurfaceSplitLayout().railWidth : SURFACE_RAIL_DEFAULT_PX,
  )
  const roRef = useRef<ResizeObserver | null>(null)
  const observeTargetRef = useRef<HTMLElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef({
    startX: 0,
    startRail: 0,
    usable: 0,
  })

  const syncCommittedRailCss = useCallback(() => {
    if (isSurfaceSplitDragging()) return
    applyKosRailWidthCss(mainRef.current, committedRailWidthRef.current)
  }, [mainRef])

  useEffect(() => {
    return subscribeSurfaceSplitLayout(() => {
      if (isSurfaceSplitDragging()) return
      committedRailWidthRef.current = getSurfaceSplitLayout().railWidth
      syncCommittedRailCss()
    })
  }, [syncCommittedRailCss])

  const runMeasure = useCallback(() => {
    if (isSurfaceSplitDragging()) return
    const el = mainRef.current
    if (!el) return
    profileLayoutRecalc('observer', 'main-split-area')
    const changed = reportMainSplitAreaWidth(el.getBoundingClientRect().width, getCurrentOSKernelTick())
    if (changed) {
      committedRailWidthRef.current = getSurfaceSplitLayout().railWidth
      syncCommittedRailCss()
      invalidateKnowledgeOSSnapshot()
    }
  }, [mainRef, syncCommittedRailCss])

  const scheduleMeasure = useCallback(() => {
    if (isSurfaceSplitDragging()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      runMeasure()
    }, RESIZE_DEBOUNCE_MS)
  }, [runMeasure])

  const disconnectResizeObserver = useCallback(() => {
    roRef.current?.disconnect()
    roRef.current = null
    observeTargetRef.current = null
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const connectResizeObserver = useCallback(() => {
    if (!railVisible || isSurfaceSplitDragging()) return
    const el = mainRef.current
    if (!el) return
    if (observeTargetRef.current === el && roRef.current) return

    disconnectResizeObserver()
    observeTargetRef.current = el
    runMeasure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleMeasure)
      return
    }

    const ro = new ResizeObserver(() => scheduleMeasure())
    ro.observe(el)
    roRef.current = ro
  }, [disconnectResizeObserver, mainRef, railVisible, runMeasure, scheduleMeasure])

  useEffect(() => {
    connectResizeObserver()
    return () => {
      disconnectResizeObserver()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [connectResizeObserver, disconnectResizeObserver, scheduleMeasure])

  useEffect(() => {
    if (!railVisible) return
    syncCommittedRailCss()
  }, [railVisible, syncCommittedRailCss])

  const applyLiveRailWidth = useCallback(
    (nextRail: number) => {
      const main = mainRef.current
      if (!main) return
      profileLayoutRecalc('split', 'preview-css-var')
      applyKosRailWidthCss(main, nextRail)
      if (dragRef.current.usable > 0) {
        setSurfaceSplitPreview(nextRail / dragRef.current.usable)
      }
    },
    [mainRef],
  )

  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const handle = e.currentTarget
      const main = mainRef.current
      if (!main) return

      const layout = getSurfaceSplitLayout()
      const frozenMainWidth = Math.round(main.getBoundingClientRect().width)
      const usable = Math.max(
        SURFACE_RAIL_MIN_PX * 2,
        frozenMainWidth - SURFACE_SPLITTER_WIDTH_PX,
      )
      const startRail = layout.railWidth

      disconnectResizeObserver()
      beginSurfaceSplitDrag()
      beginDeepProfileDrag()

      dragRef.current = {
        startX: e.clientX,
        startRail,
        usable,
      }

      beginVerticalSplitDrag({
        handle,
        pointerId: e.pointerId,
        onMove: (clientX) => {
          const delta = dragRef.current.startX - clientX
          applyLiveRailWidth(clampRailWidth(dragRef.current.startRail + delta, dragRef.current.usable))
        },
        onEnd: () => {
          profileLayoutRecalc('split', 'commit')
          commitSurfaceSplitLayout(getCurrentOSKernelTick())
          clearKosRailWidthInline(main)
          committedRailWidthRef.current = getSurfaceSplitLayout().railWidth
          applyKosRailWidthCss(main, committedRailWidthRef.current)
          endDeepProfileDrag(committedRailWidthRef.current)
          invalidateKnowledgeOSSnapshot()
          connectResizeObserver()
        },
      })
    },
    [applyLiveRailWidth, connectResizeObserver, disconnectResizeObserver, mainRef],
  )

  const adjustRailWidth = useCallback(
    (nextWidth: number) => {
      const main = mainRef.current
      const usable = Math.max(
        SURFACE_RAIL_MIN_PX * 2,
        Math.round(main?.getBoundingClientRect().width ?? 0) - SURFACE_SPLITTER_WIDTH_PX,
      )
      const clamped = clampRailWidth(nextWidth, usable)
      setSurfaceSplitLayoutProgrammatic(clamped)
      committedRailWidthRef.current = clamped
      applyKosRailWidthCss(main, clamped)
      invalidateKnowledgeOSSnapshot()
    },
    [mainRef],
  )

  return {
    splitterWidth: SURFACE_SPLITTER_WIDTH_PX,
    onSplitterPointerDown,
    adjustRailWidth,
  }
}
