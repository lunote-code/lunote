import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../../../design-system/EmptyState'
import { Icon } from '../../../design-system/icons'
import { useGraphSlice } from './useKnowledgeOSSlice'
import { useSurfaceLayout } from './useSurfaceLayout'
import { useFrozenSurfaceLayout } from './useFrozenSurfaceLayout'
import { useGraphViewportLive } from './useGraphViewportLive'
import { isSurfaceResizing } from '../layout/surfaceSplitLayoutRuntime'
import { buildGraphNodeSpatialIndex, type GraphViewportTransform } from '../layout/graphHitTest'
import { useHostLayoutFallback } from './useHostLayoutFallback'
import {
  flushPendingGraphNavigationCenter,
  flushPendingGraphCenterWhenReady,
} from '../graphNavigationRuntime'
import {
  getActiveGraphNodeId,
  getNodeActivationRenderState,
  requestNodeActivation,
  subscribeActiveGraphNode,
  subscribeNodeActivationRenderState,
} from '../graphNodeActivationRuntime'
import { useGraphNodeRenderStability } from './useGraphNodeRenderStability'
import {
  notifyGraphLayoutReady,
  notifyGraphLayoutUnavailable,
} from '../graphReadinessRuntime'
import { resolveRouteCenterNode, setGraphInteracting, syncNoteGraphTopologyFromRoute } from '../noteGraphRuntime'
import {
  getNoteGraphDepthPreference,
  MAX_NOTE_GRAPH_DEPTH,
  MIN_NOTE_GRAPH_DEPTH,
  setNoteGraphDepthPreference,
  subscribeNoteGraphDepthPreference,
} from '../graphDepthPreference'
import {
  countActiveGraphFilterOptions,
  getNoteGraphFilterPreference,
  setNoteGraphFilterPreference,
  subscribeNoteGraphFilterPreference,
} from '../graphFilterPreference'
import {
  fitGraphViewToNodes,
  GRAPH_ZOOM_STEP,
  resetGraphViewToDefault,
  setGraphViewportIntent,
  zoomGraphViewByFactor,
} from '../graphViewportRuntime'
import type { NoteGraphNode } from '../types'
import { useI18n } from '../../../i18n'
import { clampMenuElementPosition } from '../../../lib/contextMenuPosition'
import { hitGraphNodeAtEvent, navigateGraphNodeFromHit, navigateGraphNodeFromRenderedNode } from './graphPanelNavigate'
import { GraphFullscreenOverlay } from './GraphFullscreenOverlay'

type Props = {
  /** Route SSOT：workspace activeDocKey */
  centerDocKey: string | null
  layoutVariant?: 'embedded' | 'fullscreen'
}

const NODE_HIT_RADIUS = 24
const MIN_TRUSTED_LAYOUT_PX = 48
const GRAPH_INTERACTION_HINT_KEY = 'luna.graph.interactionHint.dismissed'
const GRAPH_VIEWPORT_HINT_KEY = 'luna.graph.viewportHint.dismissed'
const PAN_DRAG_THRESHOLD_PX = 4
const VIEWPORT_HINT_DELAY_MS = 600
const VIEWPORT_HINT_VISIBLE_MS = 4000
const VIEWPORT_DEVIATION_ZOOM = 0.05
const VIEWPORT_DEVIATION_PAN = 6
const BASE_NODE_RADIUS = 6
const NODE_RADIUS_STEP = 1.15
const MAX_NODE_RADIUS = 11
const CENTER_NODE_RADIUS_BONUS = 1

type GraphNodeHover = {
  id: string
  label: string
  linkCount: number
  status: NoteGraphNode['status']
  clientX: number
  clientY: number
}

function isGraphInteractionHintDismissed(): boolean {
  try {
    return localStorage.getItem(GRAPH_INTERACTION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

function isGraphViewportHintDismissed(): boolean {
  try {
    return localStorage.getItem(GRAPH_VIEWPORT_HINT_KEY) === '1'
  } catch {
    return false
  }
}

function viewportDeviatesFromDefault(viewport: { x: number; y: number; zoom: number }): boolean {
  return (
    Math.abs(viewport.zoom - 1) > VIEWPORT_DEVIATION_ZOOM ||
    Math.abs(viewport.x) > VIEWPORT_DEVIATION_PAN ||
    Math.abs(viewport.y) > VIEWPORT_DEVIATION_PAN
  )
}

function graphNodeRadius(node: NoteGraphNode, linkCount: number, isRouteCenter: boolean): number {
  const weightedRadius = Math.min(MAX_NODE_RADIUS, BASE_NODE_RADIUS + linkCount * NODE_RADIUS_STEP)
  if (node.id.startsWith('heading:')) {
    return Math.max(5, weightedRadius - 1.5)
  }
  if (node.status === 'unresolved') {
    return Math.max(BASE_NODE_RADIUS, weightedRadius - 0.75)
  }
  return Math.min(MAX_NODE_RADIUS + CENTER_NODE_RADIUS_BONUS, weightedRadius + (isRouteCenter ? CENTER_NODE_RADIUS_BONUS : 0))
}

export function GraphPanel({ centerDocKey, layoutVariant = 'embedded' }: Props) {
  const { t } = useI18n()
  const snap = useGraphSlice()
  const hostRef = useRef<HTMLDivElement>(null)
  const graphGroupRef = useRef<SVGGElement>(null)
  const isFullscreenLayout = layoutVariant === 'fullscreen'
  const layout = useSurfaceLayout('graph', hostRef)
  const layoutWithHostFallback = useHostLayoutFallback(hostRef, layout)
  const frozenLayout = useFrozenSurfaceLayout(layoutWithHostFallback)
  const [nodeHover, setNodeHover] = useState<GraphNodeHover | null>(null)
  const [interactionHintDismissed, setInteractionHintDismissed] = useState(isGraphInteractionHintDismissed)
  const [viewportHintVisible, setViewportHintVisible] = useState(false)
  const [viewportHintDismissed, setViewportHintDismissed] = useState(isGraphViewportHintDismissed)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const moreMenuPanelRef = useRef<HTMLDivElement>(null)
  const moreMenuId = useId()
  const viewportHintTimerRef = useRef(0)
  const viewportHintHideTimerRef = useRef(0)
  const [moreMenuStyle, setMoreMenuStyle] = useState<CSSProperties>({
    visibility: 'hidden',
    left: -9999,
    top: 0,
  })
  const activeGraphNodeId = useSyncExternalStore(
    subscribeActiveGraphNode,
    getActiveGraphNodeId,
    getActiveGraphNodeId,
  )
  const nodeActivationRenderState = useSyncExternalStore(
    subscribeNodeActivationRenderState,
    getNodeActivationRenderState,
    getNodeActivationRenderState,
  )
  const displayHighlightId = activeGraphNodeId
  const wheelRafRef = useRef(0)
  const wheelZoomTimeoutRef = useRef(0)
  const pendingZoomRef = useRef(1)
  const panSessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    dragging: boolean
  } | null>(null)
  const suppressGraphClickRef = useRef(false)
  const [isPanning, setIsPanning] = useState(false)

  const W =
    frozenLayout.width >= MIN_TRUSTED_LAYOUT_PX
      ? frozenLayout.width
      : layoutWithHostFallback.width
  const H =
    frozenLayout.height >= MIN_TRUSTED_LAYOUT_PX
      ? frozenLayout.height
      : layoutWithHostFallback.height
  const viewport = useGraphViewportLive(snap.nodes, { width: W, height: H }, snap.revision)
  const resizing = isSurfaceResizing()
  const { x, y, zoom } = viewport
  const graphDepth = useSyncExternalStore(
    subscribeNoteGraphDepthPreference,
    getNoteGraphDepthPreference,
    getNoteGraphDepthPreference,
  )
  const graphDepthOptions = useMemo(
    () =>
      Array.from(
        { length: MAX_NOTE_GRAPH_DEPTH - MIN_NOTE_GRAPH_DEPTH + 1 },
        (_, index) => MIN_NOTE_GRAPH_DEPTH + index,
      ),
    [],
  )
  const graphFilters = useSyncExternalStore(
    subscribeNoteGraphFilterPreference,
    getNoteGraphFilterPreference,
    getNoteGraphFilterPreference,
  )
  const activeFilterCount = countActiveGraphFilterOptions(graphFilters)

  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), [])

  const scheduleViewportHint = useCallback(() => {
    if (viewportHintDismissed || isFullscreenLayout) return
    if (viewportHintTimerRef.current !== 0) {
      window.clearTimeout(viewportHintTimerRef.current)
    }
    viewportHintTimerRef.current = window.setTimeout(() => {
      viewportHintTimerRef.current = 0
      const current = { x, y, zoom }
      if (!viewportDeviatesFromDefault(current)) return
      setViewportHintVisible(true)
      if (viewportHintHideTimerRef.current !== 0) {
        window.clearTimeout(viewportHintHideTimerRef.current)
      }
      viewportHintHideTimerRef.current = window.setTimeout(() => {
        viewportHintHideTimerRef.current = 0
        setViewportHintVisible(false)
      }, VIEWPORT_HINT_VISIBLE_MS)
    }, VIEWPORT_HINT_DELAY_MS)
  }, [isFullscreenLayout, viewportHintDismissed, x, y, zoom])

  const dismissViewportHint = useCallback(() => {
    setViewportHintVisible(false)
    setViewportHintDismissed(true)
    try {
      localStorage.setItem(GRAPH_VIEWPORT_HINT_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    return () => {
      if (viewportHintTimerRef.current !== 0) window.clearTimeout(viewportHintTimerRef.current)
      if (viewportHintHideTimerRef.current !== 0) window.clearTimeout(viewportHintHideTimerRef.current)
    }
  }, [])

  const onFitView = useCallback(() => {
    fitGraphViewToNodes(snap.nodes, W, H)
    scheduleViewportHint()
  }, [H, W, scheduleViewportHint, snap.nodes])

  const onResetZoom = useCallback(() => {
    resetGraphViewToDefault()
    setViewportHintVisible(false)
  }, [])

  const onZoomIn = useCallback(() => {
    zoomGraphViewByFactor(GRAPH_ZOOM_STEP)
    scheduleViewportHint()
  }, [scheduleViewportHint])

  const onZoomOut = useCallback(() => {
    zoomGraphViewByFactor(1 / GRAPH_ZOOM_STEP)
    scheduleViewportHint()
  }, [scheduleViewportHint])

  useLayoutEffect(() => {
    if (!moreMenuOpen) {
      setMoreMenuStyle({ visibility: 'hidden', left: -9999, top: 0 })
      return
    }

    let frame = 0
    const position = () => {
      const anchor = moreMenuTriggerRef.current
      const panel = moreMenuPanelRef.current
      if (!anchor || !panel) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const preferredLeft = anchorRect.right - panel.offsetWidth
      const preferredTop = anchorRect.bottom + 4
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      if (width === 0 || height === 0) {
        frame = window.requestAnimationFrame(position)
        return
      }

      const { x: left, y: top } = clampMenuElementPosition(panel, preferredLeft, preferredTop)
      setMoreMenuStyle({
        left,
        top,
        visibility: 'visible',
        minWidth: Math.max(220, anchorRect.width),
      })
    }

    position()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [moreMenuOpen])

  useEffect(() => {
    if (!moreMenuOpen) return
    const onDocMouseDown = (event: MouseEvent) => {
      if (event.button === 2) return
      const target = event.target as Node
      if (moreMenuTriggerRef.current?.contains(target)) return
      if (moreMenuPanelRef.current?.contains(target)) return
      closeMoreMenu()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMoreMenu()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [closeMoreMenu, moreMenuOpen])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !centerDocKey) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        onZoomIn()
      } else if (event.key === '-') {
        event.preventDefault()
        onZoomOut()
      }
    }

    host.addEventListener('keydown', onKeyDown)
    return () => host.removeEventListener('keydown', onKeyDown)
  }, [centerDocKey, onZoomIn, onZoomOut])

  useGraphNodeRenderStability(
    activeGraphNodeId,
    nodeActivationRenderState,
    snap.nodes,
    snap.edges,
    { x, y, zoom },
    W,
    H,
    graphGroupRef,
    snap.revision,
  )

  /** The topology (grid fallback) is also synchronized during boot to ensure that nodes are clickable.*/
  useLayoutEffect(() => {
    syncNoteGraphTopologyFromRoute(centerDocKey)
  }, [centerDocKey, graphDepth, graphFilters])

  const onGraphDepthChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDepth = setNoteGraphDepthPreference(Number.parseInt(event.target.value, 10))
    if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey, { depth: nextDepth })
    }
  }, [centerDocKey])

  const onToggleUnresolved = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    const next = setNoteGraphFilterPreference({
      showUnresolved: !current.showUnresolved,
    })
    if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
    setNodeHover((prev) => {
      if (next.showUnresolved) return prev
      return prev?.status === 'unresolved' ? null : prev
    })
  }, [centerDocKey])

  const onToggleHeadingNodes = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    setNoteGraphFilterPreference({
      showHeadingNodes: !current.showHeadingNodes,
    })
    if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
    setNodeHover((prev) => {
      if (!current.showHeadingNodes) return prev
      return prev?.id.startsWith('heading:') ? null : prev
    })
  }, [centerDocKey])

  const onSetDirection = useCallback(
    (edgeDirection: 'all' | 'incoming' | 'outgoing') => {
      const next = setNoteGraphFilterPreference({ edgeDirection })
      if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      }
      setNodeHover((prev) => {
        if (!prev) return null
        if (next.edgeDirection === graphFilters.edgeDirection) return prev
        return null
      })
    },
    [centerDocKey, graphFilters.edgeDirection],
  )

  useLayoutEffect(() => {
    if (W > 0 && H > 0) {
      notifyGraphLayoutReady()
    } else {
      notifyGraphLayoutUnavailable()
    }
  }, [W, H])

  useLayoutEffect(() => {
    flushPendingGraphNavigationCenter(snap.nodes, W, H)
    flushPendingGraphCenterWhenReady(snap.nodes, W, H)
  }, [snap.nodes, snap.revision, W, H])

  const nodeById = useMemo(() => {
    const map = new Map<string, NoteGraphNode>()
    for (const n of snap.nodes) map.set(n.id, n)
    return map
  }, [snap.nodes])
  const nodeSpatialIndex = useMemo(
    () => buildGraphNodeSpatialIndex(snap.nodes, NODE_HIT_RADIUS),
    [snap.nodes],
  )
  const linkCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const edge of snap.edges) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1)
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1)
    }
    return counts
  }, [snap.edges])

  const routeCenterNode = useMemo(
    () => resolveRouteCenterNode(snap.nodes, centerDocKey),
    [snap.nodes, centerDocKey],
  )

  const viewportHitFallback = useMemo((): GraphViewportTransform => ({
    panX: x,
    panY: y,
    zoom,
    width: W,
    height: H,
  }), [x, y, zoom, W, H])

  const resolveHitAtEvent = useCallback(
    (e: { clientX: number; clientY: number }) =>
      hitGraphNodeAtEvent(
        e,
        graphGroupRef.current,
        snap.nodes,
        nodeSpatialIndex,
        viewportHitFallback,
        NODE_HIT_RADIUS,
      ),
    [nodeSpatialIndex, snap.nodes, viewportHitFallback],
  )

  const navigateFromEvent = useCallback(
    (e: React.MouseEvent) => {
      const hit = resolveHitAtEvent(e)
      navigateGraphNodeFromHit(e, hit)
    },
    [resolveHitAtEvent],
  )

  const onClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (suppressGraphClickRef.current) {
        suppressGraphClickRef.current = false
        return
      }
      if ((e.target as Element | null)?.closest?.('.kos-graph-node')) {
        return
      }
      navigateFromEvent(e)
    },
    [navigateFromEvent],
  )

  const endPanSession = useCallback(() => {
    panSessionRef.current = null
    setIsPanning(false)
    setGraphInteracting(false)
  }, [])

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return

      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      panSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        dragging: false,
      }
    },
    [],
  )

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (e.button !== 0) return
      const svg = e.currentTarget.ownerSVGElement
      if (!svg) return

      e.preventDefault()
      e.stopPropagation()
      svg.setPointerCapture(e.pointerId)
      panSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        dragging: false,
      }
    },
    [],
  )

  const onSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const session = panSessionRef.current
    if (!session || session.pointerId !== e.pointerId) return

    const dx = e.clientX - session.lastX
    const dy = e.clientY - session.lastY
    session.lastX = e.clientX
    session.lastY = e.clientY

    if (!session.dragging) {
      const totalDx = e.clientX - session.startX
      const totalDy = e.clientY - session.startY
      if (Math.hypot(totalDx, totalDy) < PAN_DRAG_THRESHOLD_PX) return
      session.dragging = true
      suppressGraphClickRef.current = true
      setIsPanning(true)
      setGraphInteracting(true)
    }

    if (dx !== 0 || dy !== 0) {
      setGraphViewportIntent({ kind: 'pan', dx, dy })
      scheduleViewportHint()
    }
  }, [scheduleViewportHint])

  const onSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const session = panSessionRef.current
      if (!session || session.pointerId !== e.pointerId) return

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }

      if (session.dragging) {
        suppressGraphClickRef.current = true
      }
      endPanSession()
    },
    [endPanSession],
  )

  const onNodeClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (suppressGraphClickRef.current) {
      suppressGraphClickRef.current = false
    }
    e.stopPropagation()
    const nodeId = e.currentTarget.getAttribute('data-graph-node-id')
    if (nodeId) {
      requestNodeActivation(nodeId)
    }
  }, [])

  const onNodeDoubleClick = useCallback(
    (n: NoteGraphNode, e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation()
      if (suppressGraphClickRef.current) {
        suppressGraphClickRef.current = false
        return
      }
      if (!n.navigable) return
      navigateGraphNodeFromRenderedNode(e, n)
    },
    [],
  )

  const onNodeMouseEnter = useCallback(
    (n: NoteGraphNode, e: React.MouseEvent<SVGGElement>) => {
      setNodeHover({
        id: n.id,
        label: n.label,
        linkCount: linkCountByNodeId.get(n.id) ?? 0,
        status: n.status,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    },
    [linkCountByNodeId],
  )

  const onNodeMouseMove = useCallback((e: React.MouseEvent<SVGGElement>) => {
    setNodeHover((prev) =>
      prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null,
    )
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setNodeHover(null)
  }, [])

  const dismissInteractionHint = useCallback(() => {
    setInteractionHintDismissed(true)
    try {
      localStorage.setItem(GRAPH_INTERACTION_HINT_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const flushWheelZoom = useCallback(() => {
    wheelRafRef.current = 0
    if (wheelZoomTimeoutRef.current !== 0) {
      window.clearTimeout(wheelZoomTimeoutRef.current)
      wheelZoomTimeoutRef.current = 0
    }
    const factor = pendingZoomRef.current
    pendingZoomRef.current = 1
    if (factor === 1) {
      setGraphInteracting(false)
      return
    }
    setGraphViewportIntent({ kind: 'zoom', factor })
    setGraphInteracting(false)
    scheduleViewportHint()
  }, [scheduleViewportHint])

  const scheduleWheelZoomFlush = useCallback(() => {
    if (wheelRafRef.current !== 0) return
    wheelRafRef.current = requestAnimationFrame(flushWheelZoom)
    // RDP/VPS often throttles rAF; ensure zoom still applies.
    if (wheelZoomTimeoutRef.current !== 0) {
      window.clearTimeout(wheelZoomTimeoutRef.current)
    }
    wheelZoomTimeoutRef.current = window.setTimeout(() => {
      wheelZoomTimeoutRef.current = 0
      if (wheelRafRef.current !== 0) {
        cancelAnimationFrame(wheelRafRef.current)
        flushWheelZoom()
      }
    }, 32)
  }, [flushWheelZoom])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setGraphInteracting(true)
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      pendingZoomRef.current *= factor
      scheduleWheelZoomFlush()
    },
    [scheduleWheelZoomFlush],
  )

  const zoomPercentLabel = `${Math.round(zoom * 100)}%`

  if (!centerDocKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty" ref={hostRef}>
        <EmptyState variant="compact" icon="graph" title={t('knowledge.graph.emptyDoc')} />
      </div>
    )
  }

  return (
    <div className="kos-surface-host" ref={hostRef} tabIndex={-1}>
      <div className={`kos-graph-panel${resizing ? ' kos-graph-panel--resizing' : ''}${isFullscreenLayout ? ' kos-graph-panel--fullscreen' : ''}`}>
        <div className="kos-graph-toolbar">
          <p className="kos-graph-title">{t('knowledge.graph.title')}</p>
          <div className="kos-graph-toolbar-controls">
            <div className="kos-graph-segment" role="group" aria-label={t('knowledge.graph.directionAria')}>
              <button
                type="button"
                className={`kos-graph-segment-btn${graphFilters.edgeDirection === 'all' ? ' is-active' : ''}`}
                aria-pressed={graphFilters.edgeDirection === 'all'}
                aria-label={t('knowledge.graph.directionAll')}
                onClick={() => onSetDirection('all')}
              >
                {t('knowledge.graph.directionAllShort')}
              </button>
              <button
                type="button"
                className={`kos-graph-segment-btn${graphFilters.edgeDirection === 'incoming' ? ' is-active' : ''}`}
                aria-pressed={graphFilters.edgeDirection === 'incoming'}
                aria-label={t('knowledge.graph.directionIncoming')}
                onClick={() => onSetDirection('incoming')}
              >
                {t('knowledge.graph.directionIncomingShort')}
              </button>
              <button
                type="button"
                className={`kos-graph-segment-btn${graphFilters.edgeDirection === 'outgoing' ? ' is-active' : ''}`}
                aria-pressed={graphFilters.edgeDirection === 'outgoing'}
                aria-label={t('knowledge.graph.directionOutgoing')}
                onClick={() => onSetDirection('outgoing')}
              >
                {t('knowledge.graph.directionOutgoingShort')}
              </button>
            </div>
            <div className="kos-graph-viewport-controls" role="group" aria-label={t('knowledge.graph.viewportControlsAria')}>
              <button
                type="button"
                className="kos-graph-icon-btn"
                aria-label={t('knowledge.graph.zoomOut')}
                data-testid="kos-graph-zoom-out"
                onClick={onZoomOut}
              >
                <Icon name="zoom-out" size={14} />
              </button>
              <span className="kos-graph-zoom-label" aria-live="polite">
                {zoomPercentLabel}
              </span>
              <button
                type="button"
                className="kos-graph-icon-btn"
                aria-label={t('knowledge.graph.zoomIn')}
                data-testid="kos-graph-zoom-in"
                onClick={onZoomIn}
              >
                <Icon name="zoom-in" size={14} />
              </button>
              <button
                type="button"
                className="kos-graph-text-btn"
                aria-label={t('knowledge.graph.fitView')}
                data-testid="kos-graph-fit-view"
                onClick={onFitView}
              >
                {t('knowledge.graph.fitViewShort')}
              </button>
              <button
                type="button"
                className="kos-graph-text-btn"
                aria-label={t('knowledge.graph.resetZoom')}
                data-testid="kos-graph-reset-zoom"
                onClick={onResetZoom}
              >
                {t('knowledge.graph.resetZoomShort')}
              </button>
              {!isFullscreenLayout ? (
                <button
                  type="button"
                  className="kos-graph-icon-btn"
                  aria-label={t('knowledge.graph.fullscreen')}
                  data-testid="kos-graph-fullscreen-open"
                  onClick={() => setFullscreenOpen(true)}
                >
                  <Icon name="fullscreen" size={14} />
                </button>
              ) : null}
            </div>
            <button
              ref={moreMenuTriggerRef}
              type="button"
              className={`kos-graph-more-menu-trigger${moreMenuOpen ? ' is-active' : ''}${activeFilterCount > 0 ? ' has-filters' : ''}`}
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
              aria-controls={moreMenuOpen ? moreMenuId : undefined}
              aria-label={t('knowledge.graph.moreMenuAria')}
              data-testid="kos-graph-more-menu"
              onClick={() => setMoreMenuOpen((open) => !open)}
            >
              {t('knowledge.graph.moreMenu')}
              {activeFilterCount > 0 ? (
                <span className="kos-graph-filter-menu-badge" aria-hidden="true">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        {snap.graphLimit ? (
          <p className="kos-graph-limit-notice" role="status" data-testid="kos-graph-limit-notice">
            {t('knowledge.graph.limitNotice', {
              shownNodes: snap.graphLimit.shownNodes,
              shownEdges: snap.graphLimit.shownEdges,
              maxNodes: snap.graphLimit.maxNodes,
              maxEdges: snap.graphLimit.maxEdges,
            })}
          </p>
        ) : null}
        {moreMenuOpen
          ? createPortal(
              <div
                id={moreMenuId}
                ref={moreMenuPanelRef}
                className="kos-graph-more-menu-panel"
                role="menu"
                aria-label={t('knowledge.graph.moreMenuAria')}
                style={moreMenuStyle}
              >
                <label className="kos-graph-more-menu-depth">
                  <span className="kos-graph-depth-label">{t('knowledge.graph.depthLabel')}</span>
                  <select
                    className="kos-graph-depth-select"
                    value={graphDepth}
                    onChange={onGraphDepthChange}
                    aria-label={t('knowledge.graph.depthAria')}
                  >
                    {graphDepthOptions.map((optionDepth) => (
                      <option key={optionDepth} value={optionDepth}>
                        {optionDepth}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  className={`kos-graph-filter-menu-item${graphFilters.showUnresolved ? ' is-active' : ''}`}
                  aria-checked={graphFilters.showUnresolved}
                  onClick={onToggleUnresolved}
                >
                  {t('knowledge.graph.filterUnresolved')}
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  className={`kos-graph-filter-menu-item${graphFilters.showHeadingNodes ? ' is-active' : ''}`}
                  aria-checked={graphFilters.showHeadingNodes}
                  onClick={onToggleHeadingNodes}
                >
                  {t('knowledge.graph.filterHeadingNodes')}
                </button>
              </div>,
              document.body,
            )
          : null}
        {!interactionHintDismissed ? (
          <div className="kos-graph-interaction-hint" data-testid="kos-graph-interaction-hint">
            <span className="kos-graph-interaction-hint-text">{t('knowledge.graph.interactionHint')}</span>
            <button
              type="button"
              className="kos-graph-interaction-hint-dismiss"
              data-testid="kos-graph-interaction-hint-dismiss"
              onClick={dismissInteractionHint}
            >
              {t('knowledge.graph.interactionDismiss')}
            </button>
          </div>
        ) : null}
        {viewportHintVisible ? (
          <div className="kos-graph-viewport-hint" role="status" data-testid="kos-graph-viewport-hint">
            <span className="kos-graph-viewport-hint-text">{t('knowledge.graph.viewportHint')}</span>
            <button type="button" className="kos-graph-viewport-hint-action" onClick={onFitView}>
              {t('knowledge.graph.fitViewShort')}
            </button>
            <button
              type="button"
              className="kos-graph-viewport-hint-dismiss"
              data-testid="kos-graph-viewport-hint-dismiss"
              onClick={dismissViewportHint}
            >
              {t('knowledge.graph.interactionDismiss')}
            </button>
          </div>
        ) : null}
        <div className="kos-graph-stage" tabIndex={0}>
          <svg
            className={`kos-graph-svg${isPanning ? ' is-panning' : ''}`}
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            onClick={onClick}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerCancel={onSvgPointerUp}
            onDragStart={(e) => e.preventDefault()}
            onWheel={onWheel}
            role="img"
            aria-label={t('knowledge.graph.aria')}
          >
            <g
              ref={graphGroupRef}
              className="kos-graph-world"
              transform={`translate(${x + W / 2}, ${y + H / 2}) scale(${zoom})`}
            >
              {snap.edges.map((edge) => {
                const a = nodeById.get(edge.from)
                const b = nodeById.get(edge.to)
                if (!a || !b) return null
                return (
                  <line
                    key={edge.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`kos-graph-edge kos-graph-edge--${edge.kind}`}
                  />
                )
              })}
              {snap.nodes.map((n) => {
                const isRouteCenter = routeCenterNode?.id === n.id
                const isHighlighted = displayHighlightId === n.id
                const nodeLinkCount = linkCountByNodeId.get(n.id) ?? 0
                const nodeRadius = graphNodeRadius(n, nodeLinkCount, isRouteCenter)
                return (
                  <g
                    key={n.id}
                    data-graph-node-id={n.id}
                    data-graph-node-radius={nodeRadius}
                    className={`kos-graph-node${isHighlighted ? ' kos-graph-node--selected' : ''}${isRouteCenter ? ' kos-graph-node--center' : ''}${n.status === 'unresolved' ? ' kos-graph-node--unresolved' : ''}${n.navigable ? ' kos-graph-node--navigable' : ''}`}
                    transform={`translate(${n.x}, ${n.y})`}
                    onMouseEnter={(e) => onNodeMouseEnter(n, e)}
                    onMouseMove={onNodeMouseMove}
                    onMouseLeave={onNodeMouseLeave}
                    onPointerDown={n.navigable ? onNodePointerDown : undefined}
                    onClick={onNodeClick}
                    onDoubleClick={n.navigable ? (e) => onNodeDoubleClick(n, e) : undefined}
                  >
                    <circle
                      r={nodeRadius}
                      className="kos-graph-node-dot"
                    />
                    <text y={nodeRadius + 10} textAnchor="middle" className="kos-graph-node-label">
                      {n.label.length > 14 ? `${n.label.slice(0, 12)}…` : n.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
          {nodeHover ? (
            <div
              className="kos-graph-tooltip"
              style={{ left: nodeHover.clientX + 12, top: nodeHover.clientY + 12 }}
              role="tooltip"
            >
              <div className="kos-graph-tooltip-title">{nodeHover.label}</div>
              <div className="kos-graph-tooltip-meta">
                {t('knowledge.graph.nodeTooltipLinks', { count: nodeHover.linkCount })}
                {nodeHover.status === 'unresolved'
                  ? ` · ${t('knowledge.graph.nodeTooltipUnresolved')}`
                  : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {fullscreenOpen && centerDocKey && !isFullscreenLayout ? (
        <GraphFullscreenOverlay centerDocKey={centerDocKey} onClose={() => setFullscreenOpen(false)} />
      ) : null}
    </div>
  )
}
