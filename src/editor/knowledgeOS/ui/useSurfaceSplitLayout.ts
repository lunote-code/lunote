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
  type SurfaceSplitDragSession,
  SURFACE_RAIL_DEFAULT_PX,
  SURFACE_RAIL_MIN_PX,
  SURFACE_SPLITTER_WIDTH_PX,
} from '../layout/surfaceSplitLayoutRuntime'
import {
  applyRailDragPreview,
  beginRailDragCompositor,
  clearFrozenSplitGrid,
  clearRailDragPreview,
  freezeSplitGridColumns,
} from '../layout/surfaceSplitDragPreview'
import {
  beginDeepProfileDrag,
  endDeepProfileDrag,
  flushDeepProfileFrame,
  profileLayoutRecalc,
} from '../layout/surfaceSplitLayoutProfile'
import { getCurrentOSKernelTick } from '../osKernelClock'
import { invalidateKnowledgeOSSnapshot } from '../knowledgeUIBridge'

const RESIZE_DEBOUNCE_MS = 200

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
    session: null as SurfaceSplitDragSession | null,
    railEl: null as HTMLElement | null,
    startX: 0,
    startRail: 0,
    usable: 0,
    rafId: 0,
    pendingRatio: null as number | null,
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

  const flushPreviewFrame = useCallback(() => {
    dragRef.current.rafId = 0
    const ratio = dragRef.current.pendingRatio
    const session = dragRef.current.session
    if (ratio == null || !session) return
    dragRef.current.pendingRatio = null

    profileLayoutRecalc('split', 'preview-transform')
    const previewWidth = setSurfaceSplitPreview(ratio)
    const { scaleX, frozen, preview } = applyRailDragPreview(
      dragRef.current.railEl,
      previewWidth,
      session.frozenRailWidth,
    )
    flushDeepProfileFrame(scaleX, frozen, preview)
  }, [])

  const schedulePreview = useCallback(
    (ratio: number) => {
      dragRef.current.pendingRatio = ratio
      if (dragRef.current.rafId !== 0) return
      dragRef.current.rafId = requestAnimationFrame(flushPreviewFrame)
    },
    [flushPreviewFrame],
  )

  const endDrag = useCallback(
    (handleEl: HTMLElement, pointerId: number) => {
      const main = mainRef.current
      const rail = dragRef.current.railEl

      if (dragRef.current.rafId !== 0) {
        cancelAnimationFrame(dragRef.current.rafId)
        dragRef.current.rafId = 0
      }
      dragRef.current.pendingRatio = null

      try {
        handleEl.releasePointerCapture(pointerId)
      } catch {
        /* already released */
      }

      main?.classList.remove('is-kos-split-dragging')
      clearRailDragPreview(rail)
      clearFrozenSplitGrid(main)

      profileLayoutRecalc('split', 'commit')
      commitSurfaceSplitLayout(getCurrentOSKernelTick())
      clearKosRailWidthInline(main)
      committedRailWidthRef.current = getSurfaceSplitLayout().railWidth
      applyKosRailWidthCss(main, committedRailWidthRef.current)
      endDeepProfileDrag(committedRailWidthRef.current)
      invalidateKnowledgeOSSnapshot()

      dragRef.current.session = null
      dragRef.current.railEl = null

      connectResizeObserver()
    },
    [connectResizeObserver, mainRef],
  )

  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)

      const main = mainRef.current
      if (!main) return

      const layout = getSurfaceSplitLayout()
      const editorStack = main.querySelector('.main-editor-stack') as HTMLElement | null
      const rail = main.querySelector('.kos-right-rail') as HTMLElement | null

      profileLayoutRecalc('editor', 'drag-start-offsetWidth-once')
      const frozenEditorWidth = Math.round(editorStack?.offsetWidth ?? 0)
      const frozenRailWidth = Math.round(layout.railWidth)
      const frozenMainWidth = Math.round(main.getBoundingClientRect().width)

      const session: SurfaceSplitDragSession = {
        frozenEditorWidth,
        frozenRailWidth,
        frozenMainWidth,
      }

      const usable = Math.max(
        SURFACE_RAIL_MIN_PX * 2,
        frozenMainWidth - SURFACE_SPLITTER_WIDTH_PX,
      )

      disconnectResizeObserver()
      beginSurfaceSplitDrag(session)
      freezeSplitGridColumns(main, session)
      beginRailDragCompositor(rail, session.frozenRailWidth)
      beginDeepProfileDrag()
      main.classList.add('is-kos-split-dragging')

      dragRef.current = {
        session,
        railEl: rail,
        startX: e.clientX,
        startRail: frozenRailWidth,
        usable,
        rafId: 0,
        pendingRatio: null,
      }

      const onMove = (ev: PointerEvent) => {
        const delta = dragRef.current.startX - ev.clientX
        const nextRail = Math.max(SURFACE_RAIL_MIN_PX, dragRef.current.startRail + delta)
        const ratio =
          dragRef.current.usable > 0 ? nextRail / dragRef.current.usable : layout.splitRatio
        schedulePreview(ratio)
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        endDrag(e.currentTarget, ev.pointerId)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [disconnectResizeObserver, endDrag, mainRef, schedulePreview],
  )

  return {
    splitterWidth: SURFACE_SPLITTER_WIDTH_PX,
    onSplitterPointerDown,
  }
}
