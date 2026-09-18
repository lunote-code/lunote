import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../../../design-system/EmptyState'
import { Icon } from '../../../design-system/icons'
import { RevealPopoverSelect } from '../../../components/RevealPopoverSelect'
import { useGraphSlice } from './useKnowledgeOSSlice'
import { useSurfaceLayout } from './useSurfaceLayout'
import { useFrozenSurfaceLayout } from './useFrozenSurfaceLayout'
import { useGraphViewportLive } from './useGraphViewportLive'
import { useSurfaceSplitResizing } from './useSurfaceSplitResizing'
import { buildGraphNodeSpatialIndex, findGraphNodeAtWorldWithIndex, screenToGraphWorld, type GraphViewportTransform } from '../layout/graphHitTest'
import { buildGraphFitNodeBounds, measureGraphNodeCenterSpan } from '../layout/graphFitBounds'
import { useHostLayoutFallback } from './useHostLayoutFallback'
import {
  flushPendingGraphNavigationCenter,
  flushPendingGraphCenterWhenReady,
} from '../graphNavigationRuntime'
import {
  getActiveGraphNodeId,
  getNodeActivationRenderState,
  requestNodeActivation,
  setActiveGraphNodeId,
  subscribeActiveGraphNode,
  subscribeNodeActivationRenderState,
} from '../graphNodeActivationRuntime'
import { useGraphNodeRenderStability } from './useGraphNodeRenderStability'
import {
  notifyGraphLayoutReady,
  notifyGraphLayoutUnavailable,
} from '../graphReadinessRuntime'
import { hasPendingGraphLayoutJobs } from '../graphLayoutDependencyRuntime'
import { resolveRouteCenterNode, setGraphInteracting, setGraphNodeManualPosition, syncNoteGraphTopologyFromRoute, syncNoteGraphTopologyGlobal, getNoteGraphTopology, isNoteGraphOnFallbackLayout, expandNoteGraphHub } from '../noteGraphRuntime'
import {
  getNoteGraphDepthPreference,
  MAX_NOTE_GRAPH_DEPTH,
  MIN_NOTE_GRAPH_DEPTH,
  setNoteGraphDepthPreference,
  subscribeNoteGraphDepthPreference,
} from '../graphDepthPreference'
import {
  getGraphMoreMenuBadgeCount,
  getNoteGraphFilterPreference,
  setNoteGraphFilterPreference,
  subscribeNoteGraphFilterPreference,
} from '../graphFilterPreference'
import {
  getNoteGraphTopologyModePreference,
  setNoteGraphTopologyModePreference,
  subscribeNoteGraphTopologyModePreference,
  type NoteGraphTopologyMode,
} from '../graphTopologyModePreference'
import {
  getNoteGraphPerformanceTier,
  listNoteGraphPerformanceTiers,
  setNoteGraphPerformanceTier,
  subscribeNoteGraphPerformanceTier,
  type NoteGraphPerformanceTier,
} from '../graphPerformancePreference'
import { exportGraphPng, exportGraphSvg } from '../graphExportRuntime'
import { pushAppToast } from '../../../app/toast/appToastStore'
import { getKnowledgeOSSnapshot } from '../knowledgeUIBridge'
import { GraphDiscoveryPanel } from './GraphDiscoveryPanel'
import { GraphPresetSaveDialog } from './GraphPresetSaveDialog'
import { useGraphLinkSuggestions } from './useGraphLinkSuggestions'
import {
  deleteGraphViewPreset,
  listGraphViewPresets,
  saveGraphViewPreset,
  subscribeGraphViewPresets,
  type GraphViewPreset,
} from '../graphViewPresetStorage'
import type { GraphRecentActivityWindow } from '../graphRecentActivityFilter'
import { graphPrimaryTagColor } from '../graphTagColor'
import { getDocumentMeta, getIncomingLinkRefs, getOutgoingLinkRefs, listAllTags } from '../../knowledgeRuntime'
import {
  collectGraphFolderLegendEntries,
  graphFolderColor,
  graphFolderKeyFromDocKey,
} from '../graphFolderColor'
import {
  autoFitGraphViewportOnTopologyChange,
  bumpGraphPanelMountGeneration,
  fitGraphViewToNodes,
  getGraphViewport,
  GRAPH_ZOOM_STEP,
  resetGraphViewToDefault,
  setGraphViewportIntent,
  zoomGraphViewByFactor,
  centerGraphOnNode,
} from '../graphViewportRuntime'
import type { NoteGraphNode } from '../types'
import { filterGraphNodeSearchMatches } from '../graphNodeSearch'
import { useI18n } from '../../../i18n'
import { clampMenuElementPosition } from '../../../lib/contextMenuPosition'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import { useMenuListKeyboard } from '../../../lib/useMenuListKeyboard'
import { hitGraphNodeAtEvent, navigateGraphNodeFromHit, navigateGraphNodeFromRenderedNode } from './graphPanelNavigate'
import { GraphFullscreenOverlay } from './GraphFullscreenOverlay'
import { resolveGraphNodeLabelDisplay } from './graphNodeLabel'
import { buildGraphMoreMenuSummary, buildGraphToolbarSubtitle } from './graphToolbarSummary'
import { createGraphWikiLink } from '../graphLinkCreationRuntime'
import { removeGraphWikiLink } from '../graphLinkRemovalRuntime'
import { isGraphWikiLinkSourceNode, resolveGraphLinkDropTarget } from '../graphLinkDrag'
import { getKnowledgeInteractionHost } from './knowledgeInteractionHost'
import type { NoteGraphEdge } from '../types'

type Props = {
  /** Route SSOT：workspace activeDocKey */
  centerDocKey: string | null
  layoutVariant?: 'embedded' | 'fullscreen'
  /** When global, show workspace-wide nodes (fullscreen). Local subgraph uses centerDocKey + depth. */
  topologyMode?: 'local' | 'global'
  /** Skip topology sync while another graph panel owns the runtime (embedded during fullscreen). */
  suspendTopologySync?: boolean
}

const NODE_HIT_RADIUS = 24
const MIN_TRUSTED_LAYOUT_PX = 48
const GRAPH_INTERACTION_HINT_KEY = 'luna.graph.interactionHint.dismissed'
const GRAPH_VIEWPORT_HINT_KEY = 'luna.graph.viewportHint.dismissed'
const PAN_DRAG_THRESHOLD_PX = 4
const GRAPH_RENDER_CULL_MIN_NODES = 48
const GRAPH_VIEWPORT_CULL_PADDING = 80
const GRAPH_HUB_EXPAND_DEGREE = 4

function captureGraphPointer(svg: SVGSVGElement, pointerId: number): void {
  try {
    svg.setPointerCapture(pointerId)
  } catch {
    /* Synthetic pointers (tests) may not support capture. */
  }
}
const VIEWPORT_HINT_DELAY_MS = 600
const VIEWPORT_HINT_VISIBLE_MS = 4000
const VIEWPORT_DEVIATION_ZOOM = 0.05
const VIEWPORT_DEVIATION_PAN = 6
import {
  buildGraphNodeReferenceCounts,
  estimateGraphNodeRadius,
} from '../graphNodeReferenceWeight'

type GraphNodeHover = {
  id: string
  label: string
  referenceCount: number
  status: NoteGraphNode['status']
  clientX: number
  clientY: number
  isHeadingNode: boolean
  folderKey: string | null
  preview?: string
  tags: string[]
  incomingCount: number
  outgoingCount: number
}

function clampGraphTooltipPosition(clientX: number, clientY: number): { left: number; top: number } {
  const margin = 10
  const offset = 12
  const estW = 240
  const estH = 64
  if (typeof window === 'undefined') {
    return { left: clientX + offset, top: clientY + offset }
  }
  return {
    left: Math.min(Math.max(margin, clientX + offset), window.innerWidth - estW - margin),
    top: Math.min(Math.max(margin, clientY + offset), window.innerHeight - estH - margin),
  }
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

function graphNodeRadius(node: NoteGraphNode, referenceCount: number, isFocused: boolean): number {
  return estimateGraphNodeRadius(node, referenceCount, isFocused)
}

const GRAPH_EDGE_NODE_GAP = 2
const GRAPH_EDGE_ARROW_TIP_INSET = 1.25

function trimGraphEdgeEndpoints(
  from: NoteGraphNode,
  to: NoteGraphNode,
  fromRadius: number,
  toRadius: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= fromRadius + toRadius + GRAPH_EDGE_NODE_GAP) {
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  }
  const ux = dx / len
  const uy = dy / len
  return {
    x1: from.x + ux * (fromRadius + GRAPH_EDGE_NODE_GAP),
    y1: from.y + uy * (fromRadius + GRAPH_EDGE_NODE_GAP),
    x2: to.x - ux * (toRadius + GRAPH_EDGE_NODE_GAP + GRAPH_EDGE_ARROW_TIP_INSET),
    y2: to.y - uy * (toRadius + GRAPH_EDGE_NODE_GAP + GRAPH_EDGE_ARROW_TIP_INSET),
  }
}

/** Gentle quadratic curve — stable per edge id, fans out from high-degree hubs. */
function buildGraphEdgeCurvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  edgeKey: string,
  options?: {
    fanIndex?: number
    fanCount?: number
    hubDegree?: number
  },
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 0.5) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }
  let h = 0
  for (let i = 0; i < edgeKey.length; i += 1) {
    h = (h * 31 + edgeKey.charCodeAt(i)) | 0
  }
  const sign = h % 2 === 0 ? 1 : -1
  const fanCount = Math.max(1, options?.fanCount ?? 1)
  const fanIndex = options?.fanIndex ?? 0
  const hubDegree = Math.max(1, options?.hubDegree ?? 1)
  const fanSpread =
    fanCount > 1
      ? (fanIndex - (fanCount - 1) / 2) * Math.min(24, 5 + fanCount * 1.5)
      : 0
  const degreeBoost = Math.min(10, Math.sqrt(hubDegree) * 1.25)
  const curvature =
    Math.min(len * (0.09 + fanCount * 0.007), 12 + degreeBoost) * sign + fanSpread * 0.45
  const nx = -dy / len
  const ny = dx / len
  const cx = (x1 + x2) / 2 + nx * curvature
  const cy = (y1 + y2) / 2 + ny * curvature
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function GraphFilterMenuCheckbox({
  checked,
  label,
  onToggle,
  disabled = false,
  title,
}: {
  checked: boolean
  label: string
  onToggle: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      className={`kos-graph-filter-menu-item${disabled ? ' is-disabled' : ''}`}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="kos-graph-filter-menu-item-check" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12.5L10 17.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="kos-graph-filter-menu-item-label">{label}</span>
    </button>
  )
}

function GraphTopologyModeSegment({
  className,
  localTestId,
  globalTestId,
  isGlobalTopology,
  onSetTopologyMode,
}: {
  className?: string
  localTestId: string
  globalTestId: string
  isGlobalTopology: boolean
  onSetTopologyMode: (mode: 'local' | 'global') => void
}) {
  const { t } = useI18n()

  return (
    <div className={className} role="group" aria-label={t('knowledge.graph.topologyModeAria')}>
      <button
        type="button"
        className={`kos-graph-segment-btn${!isGlobalTopology ? ' is-active' : ''}`}
        aria-pressed={!isGlobalTopology}
        aria-label={t('knowledge.graph.topologyLocal')}
        data-testid={localTestId}
        onClick={() => onSetTopologyMode('local')}
      >
        {t('knowledge.graph.topologyLocalShort')}
      </button>
      <button
        type="button"
        className={`kos-graph-segment-btn${isGlobalTopology ? ' is-active' : ''}`}
        aria-pressed={isGlobalTopology}
        aria-label={t('knowledge.graph.topologyGlobal')}
        data-testid={globalTestId}
        onClick={() => onSetTopologyMode('global')}
      >
        {t('knowledge.graph.topologyGlobalShort')}
      </button>
    </div>
  )
}

const GRAPH_MORE_MENU_HIDDEN_STYLE: CSSProperties = {
  visibility: 'hidden',
  left: -9999,
  top: 0,
}

function graphMoreMenuHiddenStyleEqual(prev: CSSProperties): boolean {
  return (
    prev.visibility === GRAPH_MORE_MENU_HIDDEN_STYLE.visibility &&
    prev.left === GRAPH_MORE_MENU_HIDDEN_STYLE.left &&
    prev.top === GRAPH_MORE_MENU_HIDDEN_STYLE.top
  )
}

function graphMoreMenuVisibleStyleEqual(
  prev: CSSProperties,
  left: number,
  top: number,
  minWidth: number,
): boolean {
  return (
    prev.visibility === 'visible' &&
    prev.left === left &&
    prev.top === top &&
    prev.minWidth === minWidth
  )
}

export function GraphPanel({
  centerDocKey,
  layoutVariant = 'embedded',
  topologyMode = 'local',
  suspendTopologySync = false,
}: Props) {
  const { t } = useI18n()
  const snap = useGraphSlice()
  const hostRef = useRef<HTMLDivElement>(null)
  const graphStageRef = useRef<HTMLDivElement>(null)
  const graphGroupRef = useRef<SVGGElement>(null)
  const isFullscreenLayout = layoutVariant === 'fullscreen'
  const embeddedTopologyMode = useSyncExternalStore(
    subscribeNoteGraphTopologyModePreference,
    getNoteGraphTopologyModePreference,
    getNoteGraphTopologyModePreference,
  )
  const isGlobalTopology =
    isFullscreenLayout || topologyMode === 'global' || embeddedTopologyMode === 'global'
  const globalFitFingerprintRef = useRef<string | null>(null)
  const topologyFitFingerprintRef = useRef<string | null>(null)
  const prevFullscreenOpenRef = useRef(false)
  const pendingEmbeddedRefitRef = useRef(false)
  const [embeddedMountGen, setEmbeddedMountGen] = useState(0)
  const embeddedMountFitDoneRef = useRef(-1)
  const pendingRouteFitCenterDocKeyRef = useRef<string | null>(null)
  const layout = useSurfaceLayout('graph', hostRef)
  const layoutWithHostFallback = useHostLayoutFallback(hostRef, layout)
  const frozenLayout = useFrozenSurfaceLayout(layoutWithHostFallback)
  const [nodeHover, setNodeHover] = useState<GraphNodeHover | null>(null)
  const [interactionHintDismissed, setInteractionHintDismissed] = useState(isGraphInteractionHintDismissed)
  const [interactionHintExpanded, setInteractionHintExpanded] = useState(false)
  const [viewportHintVisible, setViewportHintVisible] = useState(false)
  const [viewportHintDismissed, setViewportHintDismissed] = useState(isGraphViewportHintDismissed)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [presetSaveOpen, setPresetSaveOpen] = useState(false)
  const [presetSaveError, setPresetSaveError] = useState<string | null>(null)
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [graphSearchQuery, setGraphSearchQuery] = useState('')
  const [searchFocusIndex, setSearchFocusIndex] = useState(-1)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [linkDragFeedback, setLinkDragFeedback] = useState<string | null>(null)
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const ownsTopologySync = !suspendTopologySync && (isFullscreenLayout || !fullscreenOpen)
  const moreMenuPanelRef = useRef<HTMLDivElement>(null)
  const [moreMenuPanelEl, setMoreMenuPanelEl] = useState<HTMLDivElement | null>(null)
  const moreMenuId = useId()
  const centerGlowFilterId = useId().replace(/:/g, '')
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
  const linkDragSessionRef = useRef<{
    pointerId: number
    sourceNodeId: string
    sourceDocKey: string
    sourceX: number
    sourceY: number
  } | null>(null)
  const nodeDragSessionRef = useRef<{
    pointerId: number
    nodeId: string
    grabOffsetX: number
    grabOffsetY: number
    startClientX: number
    startClientY: number
    dragging: boolean
    latestX: number
    latestY: number
  } | null>(null)
  const suppressGraphClickRef = useRef(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isLinkDragging, setIsLinkDragging] = useState(false)
  const [isNodeDragging, setIsNodeDragging] = useState(false)
  const [draggingNodePos, setDraggingNodePos] = useState<{ id: string; x: number; y: number } | null>(null)
  const [linkDragPreview, setLinkDragPreview] = useState<{
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)
  const [linkDropTargetId, setLinkDropTargetId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeIdState] = useState<string | null>(null)
  const selectedEdgeRef = useRef<NoteGraphEdge | null>(null)
  const selectedEdgeIdRef = useRef<string | null>(null)
  const deleteSelectedEdgeInFlightRef = useRef(false)
  const setSelectedEdge = useCallback((edge: NoteGraphEdge | null) => {
    selectedEdgeRef.current = edge
    selectedEdgeIdRef.current = edge?.id ?? null
    setSelectedEdgeIdState(edge?.id ?? null)
  }, [])
  selectedEdgeIdRef.current = selectedEdgeId
  if (selectedEdgeId && selectedEdgeRef.current?.id !== selectedEdgeId) {
    selectedEdgeRef.current = snap.edges.find((edge) => edge.id === selectedEdgeId) ?? null
  }

  const W =
    frozenLayout.width >= MIN_TRUSTED_LAYOUT_PX
      ? frozenLayout.width
      : layoutWithHostFallback.width
  const H =
    frozenLayout.height >= MIN_TRUSTED_LAYOUT_PX
      ? frozenLayout.height
      : layoutWithHostFallback.height
  const viewport = useGraphViewportLive(snap.nodes, { width: W, height: H }, snap.revision)
  const resizing = useSurfaceSplitResizing()
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
  const graphPerformanceTier = useSyncExternalStore(
    subscribeNoteGraphPerformanceTier,
    getNoteGraphPerformanceTier,
    getNoteGraphPerformanceTier,
  )
  const graphTagOptions = useMemo(() => {
    void snap.revision
    return listAllTags()
  }, [snap.revision])
  const graphDepthSelectOptions = useMemo(
    () => graphDepthOptions.map((depth) => ({ value: String(depth), label: String(depth) })),
    [graphDepthOptions],
  )
  const graphTagSelectOptions = useMemo(
    () => [
      { value: '', label: t('knowledge.graph.filterTagAll') },
      ...graphTagOptions.map((tag) => ({ value: tag, label: `#${tag}` })),
    ],
    [graphTagOptions, t],
  )
  const graphPerformanceTierOptions = useMemo(
    () =>
      listNoteGraphPerformanceTiers().map((tier) => ({
        value: tier,
        label: t(`knowledge.graph.performanceTier.${tier}`),
      })),
    [t],
  )
  const graphRecentActivityOptions = useMemo(
    () =>
      [
        { value: 'all', label: t('knowledge.graph.recentActivityAll') },
        { value: '7d', label: t('knowledge.graph.recentActivity7d') },
        { value: '30d', label: t('knowledge.graph.recentActivity30d') },
        { value: '90d', label: t('knowledge.graph.recentActivity90d') },
      ] as const satisfies ReadonlyArray<{ value: GraphRecentActivityWindow; label: string }>,
    [t],
  )
  const graphPresets = useSyncExternalStore(
    subscribeGraphViewPresets,
    listGraphViewPresets,
    listGraphViewPresets,
  )
  const activeFilterCount = getGraphMoreMenuBadgeCount(graphFilters, graphDepth, {
    includeDepth: !isGlobalTopology,
  })

  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), [])

  useFocusTrap(moreMenuOpen, moreMenuPanelEl, {
    onEscape: closeMoreMenu,
  })

  useMenuListKeyboard(moreMenuOpen, moreMenuPanelEl, 'button:not([disabled])')

  useEffect(() => {
    if (!presetFeedback) return
    const timer = window.setTimeout(() => setPresetFeedback(null), 3000)
    return () => window.clearTimeout(timer)
  }, [presetFeedback])

  useEffect(() => {
    if (!linkDragFeedback) return
    const timer = window.setTimeout(() => setLinkDragFeedback(null), 3000)
    return () => window.clearTimeout(timer)
  }, [linkDragFeedback])

  const scheduleViewportHint = useCallback(() => {
    if (viewportHintDismissed || isFullscreenLayout) return
    if (viewportHintTimerRef.current !== 0) {
      window.clearTimeout(viewportHintTimerRef.current)
    }
    viewportHintTimerRef.current = window.setTimeout(() => {
      viewportHintTimerRef.current = 0
      const current = getGraphViewport()
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
  }, [isFullscreenLayout, viewportHintDismissed])

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
      setMoreMenuStyle((prev) =>
        graphMoreMenuHiddenStyleEqual(prev) ? prev : GRAPH_MORE_MENU_HIDDEN_STYLE,
      )
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
      const minWidth = Math.max(220, anchorRect.width)
      setMoreMenuStyle((prev) =>
        graphMoreMenuVisibleStyleEqual(prev, left, top, minWidth)
          ? prev
          : {
              left,
              top,
              visibility: 'visible',
              minWidth,
            },
      )
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
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
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

  const resyncTopology = useCallback(() => {
    if (!ownsTopologySync) return
    if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey)
      return
    }
    if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
  }, [ownsTopologySync, isGlobalTopology, centerDocKey])

  useLayoutEffect(() => {
    resyncTopology()
  }, [graphPerformanceTier, resyncTopology])

  /** The topology (grid fallback) is also synchronized during boot to ensure that nodes are clickable.*/
  useLayoutEffect(() => {
    resyncTopology()
  }, [resyncTopology, graphDepth, graphFilters])

  useEffect(() => {
    if (!isGlobalTopology) {
      globalFitFingerprintRef.current = null
    }
  }, [isGlobalTopology])

  /** Queue a viewport fit when the active note changes (applied after force layout settles). */
  useEffect(() => {
    if (!centerDocKey) {
      pendingRouteFitCenterDocKeyRef.current = null
      return
    }
    pendingRouteFitCenterDocKeyRef.current = centerDocKey
  }, [centerDocKey])

  /** Keep activation ring aligned with the route center when the active note changes.*/
  useLayoutEffect(() => {
    if (!centerDocKey) {
      setActiveGraphNodeId(null)
      return
    }
    const center = resolveRouteCenterNode(getNoteGraphTopology().nodes, centerDocKey)
    if (center?.id) {
      setActiveGraphNodeId(center.id)
    }
  }, [centerDocKey, snap.revision])

  const onGraphDepthChange = useCallback(
    (value: string) => {
      const nextDepth = setNoteGraphDepthPreference(Number.parseInt(value, 10))
      if (isGlobalTopology || !centerDocKey) return
      syncNoteGraphTopologyFromRoute(centerDocKey, { depth: nextDepth })
    },
    [centerDocKey, isGlobalTopology],
  )

  const onToggleUnresolved = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    const next = setNoteGraphFilterPreference({
      showUnresolved: !current.showUnresolved,
    })
    if (!isGlobalTopology && centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    } else if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
    }
    setNodeHover((prev) => {
      if (next.showUnresolved) return prev
      return prev?.status === 'unresolved' ? null : prev
    })
  }, [centerDocKey, isGlobalTopology])

  const onToggleHeadingNodes = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    setNoteGraphFilterPreference({
      showHeadingNodes: !current.showHeadingNodes,
    })
    if (!isGlobalTopology && centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    } else if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
    }
    setNodeHover((prev) => {
      if (!current.showHeadingNodes) return prev
      return prev?.id.startsWith('heading:') ? null : prev
    })
  }, [centerDocKey, isGlobalTopology])

  const onToggleColorByFolder = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    const nextColorByFolder = !current.colorByFolder
    setNoteGraphFilterPreference({
      colorByFolder: nextColorByFolder,
      colorByTag: nextColorByFolder ? false : current.colorByTag,
    })
  }, [])

  const onToggleAlwaysShowLabels = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    setNoteGraphFilterPreference({
      alwaysShowLabels: !current.alwaysShowLabels,
    })
  }, [])

  const onSetDirection = useCallback(
    (edgeDirection: 'all' | 'incoming' | 'outgoing') => {
      const next = setNoteGraphFilterPreference({ edgeDirection })
      if (!isGlobalTopology && centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      } else if (isGlobalTopology) {
        syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
      }
      setNodeHover((prev) => {
        if (!prev) return null
        if (next.edgeDirection === graphFilters.edgeDirection) return prev
        return null
      })
    },
    [centerDocKey, graphFilters.edgeDirection, isGlobalTopology],
  )

  const onSetTopologyMode = useCallback(
    (mode: NoteGraphTopologyMode) => {
      if (isFullscreenLayout) return
      setNoteGraphTopologyModePreference(mode)
      if (mode === 'global') {
        syncNoteGraphTopologyGlobal(centerDocKey)
      } else if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      }
    },
    [centerDocKey, isFullscreenLayout],
  )

  const onToggleOrphanNotes = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    setNoteGraphFilterPreference({
      showOrphanNotes: !current.showOrphanNotes,
    })
    if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
    }
  }, [centerDocKey, isGlobalTopology])

  const onIncreaseGraphDepth = useCallback(() => {
    if (isGlobalTopology || graphDepth >= MAX_NOTE_GRAPH_DEPTH || !centerDocKey) return
    const nextDepth = setNoteGraphDepthPreference(graphDepth + 1)
    syncNoteGraphTopologyFromRoute(centerDocKey, { depth: nextDepth })
  }, [centerDocKey, graphDepth, isGlobalTopology])

  const onGraphTagFilterChange = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      setNoteGraphFilterPreference({ filterTag: trimmed ? trimmed.toLowerCase() : null })
      if (isGlobalTopology) {
        syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
      } else if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      }
    },
    [centerDocKey, isGlobalTopology],
  )

  const onClearGraphTagFilter = useCallback(() => {
    setNoteGraphFilterPreference({ filterTag: null })
    if (isGlobalTopology) {
      syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
    } else if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
  }, [centerDocKey, isGlobalTopology])

  const onToggleColorByTag = useCallback(() => {
    const current = getNoteGraphFilterPreference()
    const nextColorByTag = !current.colorByTag
    setNoteGraphFilterPreference({
      colorByTag: nextColorByTag,
      colorByFolder: nextColorByTag ? false : current.colorByFolder,
    })
  }, [])

  const onGraphPerformanceTierChange = useCallback(
    (value: string) => {
      setNoteGraphPerformanceTier(value as NoteGraphPerformanceTier)
      if (isGlobalTopology) {
        syncNoteGraphTopologyGlobal(centerDocKey)
      } else if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      }
    },
    [centerDocKey, isGlobalTopology],
  )

  const onExportGraphSvg = useCallback(async () => {
    const svg = graphStageRef.current?.querySelector('svg.kos-graph-svg')
    if (!(svg instanceof SVGSVGElement)) return
    const ok = await exportGraphSvg(svg, {
      dialogTitle: t('knowledge.graph.exportSvg'),
      filterName: t('app.dialog.filter.svg'),
      workspaceRoot: getKnowledgeOSSnapshot().rootDir ?? undefined,
    })
    closeMoreMenu()
    if (!ok) {
      pushAppToast(t('knowledge.graph.exportFailed'), 'error')
    }
  }, [closeMoreMenu, t])

  const onExportGraphPng = useCallback(async () => {
    const svg = graphStageRef.current?.querySelector('svg.kos-graph-svg')
    if (!(svg instanceof SVGSVGElement)) return
    const ok = await exportGraphPng(svg, {
      dialogTitle: t('knowledge.graph.exportPng'),
      filterName: t('app.dialog.filter.png'),
      workspaceRoot: getKnowledgeOSSnapshot().rootDir ?? undefined,
    })
    closeMoreMenu()
    if (!ok) {
      pushAppToast(t('knowledge.graph.exportFailed'), 'error')
    }
  }, [closeMoreMenu, t])

  const onGraphRecentActivityChange = useCallback(
    (value: string) => {
      setNoteGraphFilterPreference({
        recentActivity: value as GraphRecentActivityWindow,
      })
      if (isGlobalTopology) {
        syncNoteGraphTopologyGlobal(centerDocKey, { preserveLayout: true })
      } else if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey)
      }
    },
    [centerDocKey, isGlobalTopology],
  )

  const onSaveGraphPreset = useCallback(() => {
    closeMoreMenu()
    setPresetSaveError(null)
    setPresetSaveOpen(true)
  }, [closeMoreMenu])

  const onClosePresetSaveDialog = useCallback(() => {
    setPresetSaveOpen(false)
    setPresetSaveError(null)
  }, [])

  const onCloseGraphFullscreen = useCallback(() => {
    if (centerDocKey) {
      syncNoteGraphTopologyFromRoute(centerDocKey)
    }
    topologyFitFingerprintRef.current = null
    pendingEmbeddedRefitRef.current = true
    setFullscreenOpen(false)
  }, [centerDocKey])

  const onConfirmGraphPresetSave = useCallback(
    (name: string) => {
      const result = saveGraphViewPreset({
        name: name.trim() || t('knowledge.graph.presetDefaultName'),
        topologyMode: isFullscreenLayout ? 'global' : embeddedTopologyMode,
        performanceTier: graphPerformanceTier,
        depth: graphDepth,
        filters: getNoteGraphFilterPreference(),
      })
      if (!result.ok) {
        setPresetSaveError(t('knowledge.graph.presetSaveFailed'))
        return
      }
      setPresetSaveError(null)
      setPresetSaveOpen(false)
      setPresetFeedback(t('knowledge.graph.presetSaved'))
      setMoreMenuOpen(true)
    },
    [embeddedTopologyMode, graphDepth, graphPerformanceTier, isFullscreenLayout, t],
  )

  const onDeleteGraphPreset = useCallback(
    (id: string) => {
      if (!deleteGraphViewPreset(id)) {
        setPresetFeedback(t('knowledge.graph.presetSaveFailed'))
        return
      }
      setPresetFeedback(t('knowledge.graph.presetDeleted'))
    },
    [t],
  )

  const onApplyGraphPreset = useCallback(
    (preset: GraphViewPreset) => {
      if (!isFullscreenLayout) {
        setNoteGraphTopologyModePreference(preset.topologyMode)
      }
      setNoteGraphPerformanceTier(preset.performanceTier)
      setNoteGraphDepthPreference(preset.depth)
      setNoteGraphFilterPreference(preset.filters)
      if (preset.topologyMode === 'global' || isFullscreenLayout) {
        syncNoteGraphTopologyGlobal(centerDocKey)
      } else if (centerDocKey) {
        syncNoteGraphTopologyFromRoute(centerDocKey, { depth: preset.depth })
      }
      closeMoreMenu()
    },
    [centerDocKey, closeMoreMenu, isFullscreenLayout],
  )

  const onExpandHoveredHub = useCallback(() => {
    if (!nodeHover?.id.startsWith('page:')) return
    expandNoteGraphHub(nodeHover.id)
    setNodeHover(null)
  }, [nodeHover])

  useLayoutEffect(() => {
    if (W > 0 && H > 0) {
      notifyGraphLayoutReady()
    } else {
      notifyGraphLayoutUnavailable()
    }
  }, [W, H])

  const displayNodes = useMemo(() => {
    if (!draggingNodePos) return snap.nodes
    return snap.nodes.map((node) =>
      node.id === draggingNodePos.id ? { ...node, x: draggingNodePos.x, y: draggingNodePos.y } : node,
    )
  }, [draggingNodePos, snap.nodes])

  useLayoutEffect(() => {
    const nodes = !draggingNodePos
      ? snap.nodes
      : snap.nodes.map((node) =>
          node.id === draggingNodePos.id
            ? { ...node, x: draggingNodePos.x, y: draggingNodePos.y }
            : node,
        )
    flushPendingGraphNavigationCenter(nodes, W, H)
    flushPendingGraphCenterWhenReady(nodes, W, H)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draggingNodePos fields only; object is unstable inline state
  }, [
    W,
    H,
    snap.revision,
    snap.nodes,
    draggingNodePos?.id,
    draggingNodePos?.x,
    draggingNodePos?.y,
  ])

  const nodeById = useMemo(() => {
    const map = new Map<string, NoteGraphNode>()
    for (const n of displayNodes) map.set(n.id, n)
    return map
  }, [displayNodes])
  const nodeSpatialIndex = useMemo(
    () => buildGraphNodeSpatialIndex(displayNodes, NODE_HIT_RADIUS),
    [displayNodes],
  )
  const referenceCountByNodeId = useMemo(
    () => buildGraphNodeReferenceCounts(snap.nodes, snap.edges),
    [snap.nodes, snap.edges],
  )
  const edgeCurveMetaById = useMemo(() => {
    const bySource = new Map<string, { edgeId: string; to: string }[]>()
    for (const edge of snap.edges) {
      const list = bySource.get(edge.from) ?? []
      list.push({ edgeId: edge.id, to: edge.to })
      bySource.set(edge.from, list)
    }
    const meta = new Map<
      string,
      { fanIndex: number; fanCount: number; hubDegree: number }
    >()
    for (const [from, targets] of bySource) {
      targets.sort((a, b) => a.edgeId.localeCompare(b.edgeId))
      const hubDegree = referenceCountByNodeId.get(from) ?? targets.length
      targets.forEach((target, index) => {
        meta.set(target.edgeId, {
          fanIndex: index,
          fanCount: targets.length,
          hubDegree,
        })
      })
    }
    return meta
  }, [snap.edges, referenceCountByNodeId])

  const isDenseGraph = useMemo(() => {
    const nodeCount = snap.nodes.length
    if (nodeCount === 0) return false
    const headingCount = snap.nodes.filter((node) => node.id.startsWith('heading:')).length
    const unresolvedCount = snap.nodes.filter((node) => node.status === 'unresolved').length
    const edgeDensity = snap.edges.length / nodeCount
    if (headingCount >= 3) return true
    if (headingCount >= 2 && (unresolvedCount >= 1 || edgeDensity >= 1.35)) return true
    if (nodeCount >= 8 && edgeDensity >= 1.75) return true
    return nodeCount <= 40 && headingCount >= 1 && edgeDensity >= 1.25
  }, [snap.nodes, snap.edges])

  const routeCenterNode = useMemo(
    () => resolveRouteCenterNode(snap.nodes, centerDocKey),
    [snap.nodes, centerDocKey],
  )
  const searchMatchingNodes = useMemo(
    () => filterGraphNodeSearchMatches(snap.nodes, graphSearchQuery),
    [graphSearchQuery, snap.nodes],
  )
  const searchMatchIdSet = useMemo(
    () => new Set(searchMatchingNodes.map((node) => node.id)),
    [searchMatchingNodes],
  )
  const searchFocusedNodeId =
    searchFocusIndex >= 0 && searchMatchingNodes.length > 0
      ? (searchMatchingNodes[searchFocusIndex]?.id ?? null)
      : null

  useEffect(() => {
    setSearchFocusIndex(-1)
  }, [graphSearchQuery])

  const focusSearchMatch = useCallback(
    (direction: 'next' | 'prev') => {
      if (searchMatchingNodes.length === 0 || W <= 0 || H <= 0) return
      const length = searchMatchingNodes.length
      const nextIndex =
        direction === 'next'
          ? searchFocusIndex < 0
            ? 0
            : (searchFocusIndex + 1) % length
          : searchFocusIndex < 0
            ? length - 1
            : (searchFocusIndex - 1 + length) % length
      setSearchFocusIndex(nextIndex)
      const node = searchMatchingNodes[nextIndex]
      if (!node) return
      setActiveGraphNodeId(node.id)
      centerGraphOnNode({ x: node.x, y: node.y }, W, H, 'explicit')
    },
    [H, W, searchFocusIndex, searchMatchingNodes],
  )

  const onGraphSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      focusSearchMatch(event.shiftKey ? 'prev' : 'next')
    },
    [focusSearchMatch],
  )

  const onFocusCurrentNote = useCallback(() => {
    if (!routeCenterNode || W <= 0 || H <= 0) return
    centerGraphOnNode({ x: routeCenterNode.x, y: routeCenterNode.y }, W, H, 'explicit')
  }, [W, H, routeCenterNode])

  const displayHighlightId = activeGraphNodeId ?? routeCenterNode?.id ?? null

  const pinnedRenderNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (displayHighlightId) ids.add(displayHighlightId)
    for (const id of searchMatchIdSet) ids.add(id)
    if (nodeHover?.id) ids.add(nodeHover.id)
    return ids
  }, [displayHighlightId, nodeHover?.id, searchMatchIdSet])

  const renderNodes = useMemo(() => {
    if (displayNodes.length < GRAPH_RENDER_CULL_MIN_NODES || W <= 0 || H <= 0) return displayNodes
    const halfW = W / 2
    const halfH = H / 2
    const minX = (-x - GRAPH_VIEWPORT_CULL_PADDING - halfW) / zoom
    const maxX = (W - x + GRAPH_VIEWPORT_CULL_PADDING - halfW) / zoom
    const minY = (-y - GRAPH_VIEWPORT_CULL_PADDING - halfH) / zoom
    const maxY = (H - y + GRAPH_VIEWPORT_CULL_PADDING - halfH) / zoom
    return displayNodes.filter((node) => {
      if (pinnedRenderNodeIds.has(node.id)) return true
      return node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
    })
  }, [H, W, displayNodes, pinnedRenderNodeIds, x, y, zoom])

  const renderEdges = useMemo(() => {
    if (renderNodes.length === displayNodes.length) return snap.edges
    const visible = new Set(renderNodes.map((node) => node.id))
    return snap.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to))
  }, [displayNodes.length, renderNodes, snap.edges])

  const visibleGraphDocKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const node of snap.nodes) {
      if (node.id.startsWith('page:') && node.status === 'resolved') {
        keys.add(node.docKey)
      }
    }
    if (centerDocKey) keys.add(centerDocKey)
    return [...keys]
  }, [centerDocKey, snap.nodes])

  const linkSuggestions = useGraphLinkSuggestions({
    centerDocKey,
    visibleDocKeys: visibleGraphDocKeys,
    isGlobalTopology,
    graphRevision: snap.revision,
  })
  const showLinkSuggestionBadge =
    !discoveryOpen && linkSuggestions.suggestionCount > 0

  const graphToolbarSubtitle = useMemo(
    () =>
      buildGraphToolbarSubtitle({
        isGlobal: isGlobalTopology,
        depth: graphDepth,
        nodeCount: snap.nodes.length,
        edgeCount: snap.edges.length,
        filters: graphFilters,
        t,
      }),
    [graphDepth, graphFilters, isGlobalTopology, snap.edges.length, snap.nodes.length, t],
  )
  const graphMoreMenuSummary = useMemo(
    () =>
      buildGraphMoreMenuSummary({
        isGlobal: isGlobalTopology,
        depth: graphDepth,
        nodeCount: snap.nodes.length,
        edgeCount: snap.edges.length,
        filters: graphFilters,
        t,
      }),
    [graphDepth, graphFilters, isGlobalTopology, snap.edges.length, snap.nodes.length, t],
  )
  const fitNodes = useMemo(
    () =>
      buildGraphFitNodeBounds(snap.nodes, {
        referenceCountByNodeId,
        highlightedId: displayHighlightId,
      }),
    [snap.nodes, referenceCountByNodeId, displayHighlightId],
  )

  useLayoutEffect(() => {
    setEmbeddedMountGen((gen) => gen + 1)
    if (!isFullscreenLayout) bumpGraphPanelMountGeneration()
  }, [isFullscreenLayout])

  /** Embedded panel remount (tab switch): fit once when force layout is ready. */
  useLayoutEffect(() => {
    if (isFullscreenLayout || !centerDocKey) return
    if (embeddedMountFitDoneRef.current >= embeddedMountGen) return
    if (fitNodes.length === 0 || W <= 0 || H <= 0) return
    if (isPanning || resizing) return
    if (isNoteGraphOnFallbackLayout()) return
    if (snap.nodes.length > 1 && measureGraphNodeCenterSpan(snap.nodes) < 28) return

    fitGraphViewToNodes(fitNodes, W, H)
    embeddedMountFitDoneRef.current = embeddedMountGen
  }, [
    H,
    W,
    centerDocKey,
    embeddedMountGen,
    fitNodes,
    isFullscreenLayout,
    isPanning,
    resizing,
    snap.nodes,
    snap.revision,
  ])

  /** After route note change: fit once force layout is ready so the full subgraph stays centered. */
  useLayoutEffect(() => {
    const pending = pendingRouteFitCenterDocKeyRef.current
    if (!pending || pending !== centerDocKey) return
    if (isFullscreenLayout && isGlobalTopology) return
    if (fitNodes.length === 0 || W <= 0 || H <= 0) return
    if (isPanning || resizing) return
    if (isNoteGraphOnFallbackLayout()) return
    if (hasPendingGraphLayoutJobs()) return
    if (snap.nodes.length > 1 && measureGraphNodeCenterSpan(snap.nodes) < 28) return

    fitGraphViewToNodes(fitNodes, W, H, isGlobalTopology ? 56 : 48)
    pendingRouteFitCenterDocKeyRef.current = null
  }, [
    H,
    W,
    centerDocKey,
    fitNodes,
    isFullscreenLayout,
    isGlobalTopology,
    isPanning,
    resizing,
    snap.nodes,
    snap.revision,
  ])

  /** Embedded / local: fit when topology config (center, depth, filters, mode) changes. */
  useLayoutEffect(() => {
    if (isFullscreenLayout && isGlobalTopology) return
    if (fitNodes.length === 0 || W <= 0 || H <= 0) return
    if (isPanning || resizing) return
    if (isNoteGraphOnFallbackLayout()) return
    if (snap.nodes.length > 1 && measureGraphNodeCenterSpan(snap.nodes) < 28) return

    const fingerprint = JSON.stringify({
      centerDocKey,
      graphDepth,
      topologyMode: isGlobalTopology ? 'global' : 'local',
      showUnresolved: graphFilters.showUnresolved,
      showHeadingNodes: graphFilters.showHeadingNodes,
      edgeDirection: graphFilters.edgeDirection,
    })
    const prev = topologyFitFingerprintRef.current
    if (prev === fingerprint) return
    topologyFitFingerprintRef.current = fingerprint
    if (prev === null) return

    autoFitGraphViewportOnTopologyChange(fitNodes, W, H, isGlobalTopology ? 56 : 48)
  }, [
    W,
    H,
    centerDocKey,
    graphDepth,
    graphFilters,
    fitNodes,
    isFullscreenLayout,
    isGlobalTopology,
    isPanning,
    resizing,
    snap.revision,
  ])

  /** Embedded: mark refit when exiting fullscreen (shared viewport + async local topology restore). */
  useLayoutEffect(() => {
    if (isFullscreenLayout) return

    const wasFullscreenOpen = prevFullscreenOpenRef.current
    prevFullscreenOpenRef.current = fullscreenOpen

    if (wasFullscreenOpen && !fullscreenOpen) {
      pendingEmbeddedRefitRef.current = true
    }
  }, [fullscreenOpen, isFullscreenLayout])

  /** Embedded: refit after local subgraph is restored post-fullscreen (snap.revision catches global→local). */
  useLayoutEffect(() => {
    if (isFullscreenLayout || !pendingEmbeddedRefitRef.current) return
    if (!centerDocKey || fitNodes.length === 0 || W <= 0 || H <= 0) return
    if (isPanning || resizing) return
    if (getNoteGraphTopology().centerDocKey !== centerDocKey) return
    if (isNoteGraphOnFallbackLayout()) return
    if (snap.nodes.length > 1 && measureGraphNodeCenterSpan(snap.nodes) < 28) return

    fitGraphViewToNodes(fitNodes, W, H)
    pendingEmbeddedRefitRef.current = false
  }, [
    H,
    W,
    centerDocKey,
    fitNodes,
    isFullscreenLayout,
    isPanning,
    resizing,
    snap.nodes,
    snap.revision,
  ])

  /** Global fullscreen: refit when filters or node set changes so all nodes stay visible. */
  useLayoutEffect(() => {
    if (!isFullscreenLayout || !isGlobalTopology || fitNodes.length === 0 || W <= 0 || H <= 0) return
    if (isPanning || resizing) return
    if (isNoteGraphOnFallbackLayout()) return

    const fingerprint = JSON.stringify({
      filters: {
        showUnresolved: graphFilters.showUnresolved,
        showHeadingNodes: graphFilters.showHeadingNodes,
        edgeDirection: graphFilters.edgeDirection,
      },
      nodeCount: snap.nodes.length,
      revision: snap.revision,
    })
    const prev = globalFitFingerprintRef.current
    globalFitFingerprintRef.current = fingerprint
    if (prev === fingerprint) return

    fitGraphViewToNodes(fitNodes, W, H, 72)
  }, [
    H,
    W,
    fitNodes,
    graphFilters,
    isFullscreenLayout,
    isGlobalTopology,
    isPanning,
    resizing,
    snap.nodes.length,
    snap.revision,
  ])

  const onFitView = useCallback(() => {
    const padding = isGlobalTopology ? 72 : 48
    fitGraphViewToNodes(fitNodes, W, H, padding)
    scheduleViewportHint()
  }, [H, W, fitNodes, isGlobalTopology, scheduleViewportHint])

  const folderLegendEntries = useMemo(() => {
    if (!graphFilters.colorByFolder) return []
    return collectGraphFolderLegendEntries(snap.nodes)
  }, [graphFilters.colorByFolder, snap.nodes])
  const showFolderLegend = folderLegendEntries.length >= 2
  const showNodeLegend =
    showFolderLegend || graphFilters.showUnresolved || graphFilters.showHeadingNodes

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
        displayNodes,
        nodeSpatialIndex,
        viewportHitFallback,
        NODE_HIT_RADIUS,
      ),
    [displayNodes, nodeSpatialIndex, viewportHitFallback],
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
      if ((e.target as Element | null)?.closest?.('.kos-graph-edge-group')) {
        return
      }
      setSelectedEdge(null)
      navigateFromEvent(e)
    },
    [navigateFromEvent, setSelectedEdge],
  )

  const onEdgePointerDown = useCallback((edge: NoteGraphEdge, e: React.PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedEdge(edge)
    suppressGraphClickRef.current = true
    getKnowledgeInteractionHost()?.clearEditorSelection()
    graphStageRef.current?.focus({ preventScroll: true })
  }, [setSelectedEdge])

  const onEdgeDoubleClick = useCallback(
    (edge: NoteGraphEdge, e: React.MouseEvent<SVGPathElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setSelectedEdge(edge)
      void removeGraphWikiLink(edge).then((result) => {
        if (result === 'ok') setSelectedEdge(null)
      })
    },
    [setSelectedEdge],
  )

  const deleteSelectedEdge = useCallback(async () => {
    if (deleteSelectedEdgeInFlightRef.current) return false
    const edge = selectedEdgeRef.current
    if (!edge) return false
    deleteSelectedEdgeInFlightRef.current = true
    try {
      const result = await removeGraphWikiLink(edge)
      if (result === 'ok') {
        setSelectedEdge(null)
        return true
      }
      const stillExists = getNoteGraphTopology().edges.some((entry) => entry.id === edge.id)
      if (!stillExists) {
        setSelectedEdge(null)
      }
      return false
    } finally {
      deleteSelectedEdgeInFlightRef.current = false
    }
  }, [setSelectedEdge])

  useEffect(() => {
    if (!centerDocKey) return

    const isDeleteKey = (event: KeyboardEvent) =>
      event.key === 'Delete' ||
      event.key === 'Backspace' ||
      event.code === 'Delete' ||
      event.code === 'Backspace'

    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedEdgeIdRef.current || !isDeleteKey(event)) return

      const target = event.target as HTMLElement | null
      if (!target?.closest('.kos-graph-panel')) return
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      void deleteSelectedEdge()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [centerDocKey, deleteSelectedEdge])

  const endPanSession = useCallback(() => {
    panSessionRef.current = null
    setIsPanning(false)
    setGraphInteracting(false)
  }, [])

  const endLinkDragSession = useCallback(() => {
    linkDragSessionRef.current = null
    setIsLinkDragging(false)
    setLinkDragPreview(null)
    setLinkDropTargetId(null)
    setGraphInteracting(false)
  }, [])

  const endNodeDragSession = useCallback(() => {
    nodeDragSessionRef.current = null
    setIsNodeDragging(false)
    setDraggingNodePos(null)
    setGraphInteracting(false)
  }, [])

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return
      if (linkDragSessionRef.current || nodeDragSessionRef.current) return

      e.preventDefault()
      captureGraphPointer(e.currentTarget, e.pointerId)
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
    (n: NoteGraphNode, e: React.PointerEvent<SVGGElement>) => {
      if (e.button !== 0) return
      const svg = e.currentTarget.ownerSVGElement
      if (!svg) return

      e.preventDefault()
      e.stopPropagation()

      if (e.shiftKey && isGraphWikiLinkSourceNode(n)) {
        captureGraphPointer(svg, e.pointerId)
        linkDragSessionRef.current = {
          pointerId: e.pointerId,
          sourceNodeId: n.id,
          sourceDocKey: n.docKey,
          sourceX: n.x,
          sourceY: n.y,
        }
        setIsLinkDragging(true)
        setLinkDragPreview({ x1: n.x, y1: n.y, x2: n.x, y2: n.y })
        setLinkDropTargetId(null)
        suppressGraphClickRef.current = true
        setGraphInteracting(true)
        return
      }

      const world = screenToGraphWorld(
        e.clientX,
        e.clientY,
        graphGroupRef.current,
        { panX: x, panY: y, zoom, width: W, height: H },
      )
      captureGraphPointer(svg, e.pointerId)
      nodeDragSessionRef.current = {
        pointerId: e.pointerId,
        nodeId: n.id,
        grabOffsetX: n.x - (world?.x ?? n.x),
        grabOffsetY: n.y - (world?.y ?? n.y),
        startClientX: e.clientX,
        startClientY: e.clientY,
        dragging: false,
        latestX: n.x,
        latestY: n.y,
      }
      setGraphInteracting(true)
    },
    [H, W, x, y, zoom],
  )

  const onSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const linkSession = linkDragSessionRef.current
    if (linkSession && linkSession.pointerId === e.pointerId) {
      const world = screenToGraphWorld(
        e.clientX,
        e.clientY,
        graphGroupRef.current,
        viewportHitFallback,
      )
      if (!world) return

      const hover = findGraphNodeAtWorldWithIndex(
        world.x,
        world.y,
        nodeSpatialIndex,
        displayNodes,
        NODE_HIT_RADIUS,
      )
      const dropTarget = resolveGraphLinkDropTarget(hover, linkSession.sourceNodeId)
      setLinkDropTargetId(dropTarget?.id ?? null)

      const endX = dropTarget?.x ?? world.x
      const endY = dropTarget?.y ?? world.y
      setLinkDragPreview({
        x1: linkSession.sourceX,
        y1: linkSession.sourceY,
        x2: endX,
        y2: endY,
      })
      return
    }

    const nodeSession = nodeDragSessionRef.current
    if (nodeSession && nodeSession.pointerId === e.pointerId) {
      const world = screenToGraphWorld(
        e.clientX,
        e.clientY,
        graphGroupRef.current,
        viewportHitFallback,
      )
      if (!world) return

      if (!nodeSession.dragging) {
        const totalDx = e.clientX - nodeSession.startClientX
        const totalDy = e.clientY - nodeSession.startClientY
        if (Math.hypot(totalDx, totalDy) < PAN_DRAG_THRESHOLD_PX) return
        nodeSession.dragging = true
        suppressGraphClickRef.current = true
        setIsNodeDragging(true)
      }

      const nextX = world.x + nodeSession.grabOffsetX
      const nextY = world.y + nodeSession.grabOffsetY
      nodeSession.latestX = nextX
      nodeSession.latestY = nextY
      setDraggingNodePos({
        id: nodeSession.nodeId,
        x: nextX,
        y: nextY,
      })
      return
    }

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
  }, [displayNodes, nodeSpatialIndex, scheduleViewportHint, viewportHitFallback])

  const onSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const linkSession = linkDragSessionRef.current
      if (linkSession && linkSession.pointerId === e.pointerId) {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }

        const world = screenToGraphWorld(
          e.clientX,
          e.clientY,
          graphGroupRef.current,
          viewportHitFallback,
        )
        if (world) {
          const hover = findGraphNodeAtWorldWithIndex(
            world.x,
            world.y,
            nodeSpatialIndex,
            displayNodes,
            NODE_HIT_RADIUS,
          )
          const dropTarget = resolveGraphLinkDropTarget(hover, linkSession.sourceNodeId)
          if (dropTarget) {
            void createGraphWikiLink({
              sourceDocKey: linkSession.sourceDocKey,
              targetDocKey: dropTarget.docKey,
              targetTitle: dropTarget.label,
            }).then((result) => {
              if (result === 'ok') {
                setLinkDragFeedback(t('knowledge.graph.discovery.linkAdded'))
                return
              }
              if (result === 'duplicate') {
                setLinkDragFeedback(t('knowledge.graph.discovery.linkDuplicate'))
                return
              }
              setLinkDragFeedback(t('knowledge.graph.discovery.linkFailed'))
            })
          }
        }

        suppressGraphClickRef.current = true
        endLinkDragSession()
        return
      }

      const nodeSession = nodeDragSessionRef.current
      if (nodeSession && nodeSession.pointerId === e.pointerId) {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }

        if (nodeSession.dragging) {
          setGraphNodeManualPosition(nodeSession.nodeId, {
            x: nodeSession.latestX,
            y: nodeSession.latestY,
          })
          suppressGraphClickRef.current = true
        }

        endNodeDragSession()
        return
      }

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
    [
      displayNodes,
      endLinkDragSession,
      endNodeDragSession,
      endPanSession,
      nodeSpatialIndex,
      t,
      viewportHitFallback,
    ],
  )

  const onNodeClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (suppressGraphClickRef.current) {
      suppressGraphClickRef.current = false
    }
    e.stopPropagation()
    const nodeId = e.currentTarget.getAttribute('data-graph-node-id')
    if (!nodeId) return

    setActiveGraphNodeId(nodeId)
    requestNodeActivation(nodeId)
    const node = displayNodes.find((entry) => entry.id === nodeId)
    if (node?.status === 'unresolved') {
      navigateGraphNodeFromRenderedNode(e, node, centerDocKey)
    }
  }, [centerDocKey, displayNodes])

  const onNodeDoubleClick = useCallback(
    (n: NoteGraphNode, e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation()
      if (suppressGraphClickRef.current) {
        suppressGraphClickRef.current = false
        return
      }
      if (n.status === 'unresolved') {
        navigateGraphNodeFromRenderedNode(e, n, centerDocKey)
        return
      }
      if (!n.navigable) return
      navigateGraphNodeFromRenderedNode(e, n, centerDocKey)
    },
    [centerDocKey],
  )

  const onNodeMouseEnter = useCallback(
    (n: NoteGraphNode, e: React.MouseEvent<SVGGElement>) => {
      const meta = !n.id.startsWith('heading:') ? getDocumentMeta(n.docKey) : null
      const outgoingCount = meta ? getOutgoingLinkRefs(n.docKey).length : 0
      const incomingCount = meta ? getIncomingLinkRefs(n.docKey).length : 0
      setNodeHover({
        id: n.id,
        label: n.label,
        referenceCount: referenceCountByNodeId.get(n.id) ?? 0,
        status: n.status,
        clientX: e.clientX,
        clientY: e.clientY,
        isHeadingNode: n.id.startsWith('heading:'),
        folderKey:
          graphFilters.colorByFolder && n.status === 'resolved' && !n.id.startsWith('heading:')
            ? graphFolderKeyFromDocKey(n.docKey) || null
            : null,
        preview: meta?.bodySample?.trim().slice(0, 120),
        tags: meta?.outboundTags ?? [],
        incomingCount,
        outgoingCount,
      })
    },
    [graphFilters.colorByFolder, referenceCountByNodeId],
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
    <div className="kos-surface-host" ref={hostRef}>
      <div
        className={`kos-graph-panel${resizing ? ' kos-graph-panel--resizing' : ''}${isFullscreenLayout ? ' kos-graph-panel--fullscreen' : ''}${isGlobalTopology ? ' kos-graph-panel--global' : ''}`}
        data-topology-mode={isGlobalTopology ? 'global' : 'local'}
      >
        <div className="kos-graph-toolbar">
          <div className="kos-graph-toolbar-heading">
            <p className="kos-graph-title">
              {t(isGlobalTopology ? 'knowledge.graph.globalTitle' : 'knowledge.graph.title')}
            </p>
            <p className="kos-graph-subtitle" data-testid="kos-graph-subtitle">
              {graphToolbarSubtitle}
            </p>
          </div>
          <div className="kos-graph-toolbar-controls">
            {isFullscreenLayout ? (
              <label className="kos-graph-search">
                <span className="kos-graph-search-label">{t('knowledge.graph.searchAria')}</span>
                <input
                  type="search"
                  className="kos-graph-search-input"
                  value={graphSearchQuery}
                  placeholder={t('knowledge.graph.searchPlaceholder')}
                  aria-label={t('knowledge.graph.searchAria')}
                  data-testid="kos-graph-search"
                  onChange={(event) => setGraphSearchQuery(event.target.value)}
                  onKeyDown={onGraphSearchKeyDown}
                />
              </label>
            ) : null}
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
            <button
              type="button"
              className={`kos-graph-more-menu-trigger${discoveryOpen ? ' is-active' : ''}`}
              aria-pressed={discoveryOpen}
              aria-label={t('knowledge.graph.discovery.open')}
              title={t('knowledge.graph.discovery.openHint')}
              data-testid="kos-graph-discovery-toggle"
              onClick={() => setDiscoveryOpen((open) => !open)}
            >
              {t('knowledge.graph.discovery.openShort')}
              {showLinkSuggestionBadge ? (
                <span className="kos-graph-filter-menu-badge" aria-hidden="true">
                  {linkSuggestions.suggestionCount}
                </span>
              ) : null}
            </button>
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
                title={t('knowledge.graph.fitView')}
                data-testid="kos-graph-fit-view"
                onClick={onFitView}
              >
                {t('knowledge.graph.fitViewShort')}
              </button>
              {routeCenterNode ? (
                <button
                  type="button"
                  className="kos-graph-text-btn kos-graph-toolbar-compact-hidden"
                  aria-label={t('knowledge.graph.focusCurrentNote')}
                  title={t('knowledge.graph.focusCurrentNote')}
                  data-testid="kos-graph-focus-current"
                  onClick={onFocusCurrentNote}
                >
                  {t('knowledge.graph.focusCurrentNoteShort')}
                </button>
              ) : null}
              <button
                type="button"
                className="kos-graph-text-btn kos-graph-toolbar-compact-hidden"
                aria-label={t('knowledge.graph.resetZoom')}
                title={t('knowledge.graph.resetZoomHint')}
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
                  title={t('knowledge.graph.fullscreenHint')}
                  data-testid="kos-graph-fullscreen-open"
                  onClick={() => setFullscreenOpen(true)}
                >
                  <Icon name="fullscreen" size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {discoveryOpen && centerDocKey ? (
          <GraphDiscoveryPanel
            centerDocKey={centerDocKey}
            isGlobalTopology={isGlobalTopology}
            suggestions={linkSuggestions.suggestions}
            aiLoading={linkSuggestions.aiLoading}
            aiConfigured={linkSuggestions.aiConfigured}
            aiPrefetchEnabled={linkSuggestions.aiPrefetchEnabled}
            aiError={linkSuggestions.aiError}
            onDismissSuggestion={linkSuggestions.dismissSuggestion}
            onSuggestionsChanged={linkSuggestions.refreshSuggestions}
            onClose={() => setDiscoveryOpen(false)}
          />
        ) : null}
        {linkDragFeedback ? (
          <div className="kos-graph-limit-notice" role="status" data-testid="kos-graph-link-feedback">
            <p className="kos-graph-limit-notice-text">{linkDragFeedback}</p>
          </div>
        ) : null}
        {snap.graphLimit ? (
          <div className="kos-graph-limit-notice" role="status" data-testid="kos-graph-limit-notice">
            <p className="kos-graph-limit-notice-text">
              {t('knowledge.graph.limitNotice', {
                shownNodes: snap.graphLimit.shownNodes,
                shownEdges: snap.graphLimit.shownEdges,
                maxNodes: snap.graphLimit.maxNodes,
                maxEdges: snap.graphLimit.maxEdges,
              })}
            </p>
            <div className="kos-graph-limit-notice-actions">
              {!isGlobalTopology ? (
                <button
                  type="button"
                  className="kos-graph-limit-notice-action"
                  data-testid="kos-graph-limit-action-global"
                  onClick={() => onSetTopologyMode('global')}
                >
                  {t('knowledge.graph.limitActionGlobal')}
                </button>
              ) : null}
              {!isGlobalTopology && graphDepth < MAX_NOTE_GRAPH_DEPTH ? (
                <button
                  type="button"
                  className="kos-graph-limit-notice-action"
                  data-testid="kos-graph-limit-action-depth"
                  onClick={onIncreaseGraphDepth}
                >
                  {t('knowledge.graph.limitActionDepth')}
                </button>
              ) : null}
              {!isFullscreenLayout ? (
                <button
                  type="button"
                  className="kos-graph-limit-notice-action"
                  data-testid="kos-graph-limit-action-fullscreen"
                  onClick={() => setFullscreenOpen(true)}
                >
                  {t('knowledge.graph.limitActionFullscreen')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {moreMenuOpen
          ? createPortal(
              <div
                id={moreMenuId}
                ref={(node) => {
                  moreMenuPanelRef.current = node
                  setMoreMenuPanelEl(node)
                }}
                className={`kos-graph-more-menu-panel${isFullscreenLayout ? ' kos-graph-more-menu-panel--fullscreen' : ''}`}
                role="menu"
                aria-label={t('knowledge.graph.moreMenuAria')}
                style={moreMenuStyle}
              >
                <p className="kos-graph-more-menu-summary" data-testid="kos-graph-more-menu-summary">
                  {graphMoreMenuSummary}
                </p>
                {!isFullscreenLayout ? (
                  <GraphTopologyModeSegment
                    className="kos-graph-segment kos-graph-more-menu-topology"
                    localTestId="kos-graph-more-topology-local"
                    globalTestId="kos-graph-more-topology-global"
                    isGlobalTopology={isGlobalTopology}
                    onSetTopologyMode={(mode) => {
                      onSetTopologyMode(mode)
                      setMoreMenuOpen(false)
                    }}
                  />
                ) : null}
                {!isGlobalTopology ? (
                  <div className="kos-graph-more-menu-depth">
                    <span className="kos-graph-depth-label">{t('knowledge.graph.depthLabel')}</span>
                    <RevealPopoverSelect
                      variant="compact"
                      value={String(graphDepth)}
                      options={graphDepthSelectOptions}
                      onValueChange={onGraphDepthChange}
                      ariaLabel={t('knowledge.graph.depthAria')}
                      testId="kos-graph-depth-select"
                    />
                  </div>
                ) : null}
                <div className="kos-graph-more-menu-depth">
                  <span className="kos-graph-depth-label">{t('knowledge.graph.filterTagLabel')}</span>
                  <RevealPopoverSelect
                    variant="compact"
                    value={graphFilters.filterTag ?? ''}
                    options={graphTagSelectOptions}
                    onValueChange={onGraphTagFilterChange}
                    ariaLabel={t('knowledge.graph.filterTagAria')}
                    testId="kos-graph-tag-filter"
                  />
                </div>
                {graphFilters.filterTag ? (
                  <button
                    type="button"
                    className="kos-graph-text-btn kos-graph-more-menu-action"
                    data-testid="kos-graph-tag-filter-clear"
                    onClick={onClearGraphTagFilter}
                  >
                    {t('knowledge.graph.filterTagClear')}
                  </button>
                ) : null}
                <div className="kos-graph-more-menu-depth">
                  <span className="kos-graph-depth-label">{t('knowledge.graph.performanceTierLabel')}</span>
                  <RevealPopoverSelect
                    variant="compact"
                    value={graphPerformanceTier}
                    options={graphPerformanceTierOptions}
                    onValueChange={onGraphPerformanceTierChange}
                    ariaLabel={t('knowledge.graph.performanceTierAria')}
                    testId="kos-graph-performance-tier"
                  />
                </div>
                <div className="kos-graph-more-menu-depth">
                  <span className="kos-graph-depth-label">{t('knowledge.graph.recentActivityLabel')}</span>
                  <RevealPopoverSelect
                    variant="compact"
                    value={graphFilters.recentActivity}
                    options={graphRecentActivityOptions}
                    onValueChange={onGraphRecentActivityChange}
                    ariaLabel={t('knowledge.graph.recentActivityAria')}
                    testId="kos-graph-recent-activity"
                  />
                </div>
                <GraphFilterMenuCheckbox
                  checked={graphFilters.colorByFolder}
                  label={t('knowledge.graph.filterColorByFolder')}
                  onToggle={onToggleColorByFolder}
                />
                <GraphFilterMenuCheckbox
                  checked={graphFilters.colorByTag}
                  label={t('knowledge.graph.filterColorByTag')}
                  onToggle={onToggleColorByTag}
                />
                <GraphFilterMenuCheckbox
                  checked={graphFilters.showUnresolved}
                  label={t('knowledge.graph.filterUnresolved')}
                  onToggle={onToggleUnresolved}
                />
                <GraphFilterMenuCheckbox
                  checked={graphFilters.showHeadingNodes}
                  label={t('knowledge.graph.filterHeadingNodes')}
                  onToggle={onToggleHeadingNodes}
                />
                <GraphFilterMenuCheckbox
                  checked={graphFilters.showOrphanNotes}
                  label={t('knowledge.graph.filterOrphanNotes')}
                  title={isGlobalTopology ? undefined : t('knowledge.graph.filterOrphanNotesHint')}
                  disabled={!isGlobalTopology}
                  onToggle={onToggleOrphanNotes}
                />
                <GraphFilterMenuCheckbox
                  checked={graphFilters.alwaysShowLabels}
                  label={t('knowledge.graph.filterAlwaysShowLabels')}
                  onToggle={onToggleAlwaysShowLabels}
                />
                <button
                  type="button"
                  className="kos-graph-text-btn kos-graph-more-menu-action"
                  data-testid="kos-graph-export-svg"
                  onClick={onExportGraphSvg}
                >
                  {t('knowledge.graph.exportSvg')}
                </button>
                <button
                  type="button"
                  className="kos-graph-text-btn kos-graph-more-menu-action"
                  data-testid="kos-graph-export-png"
                  onClick={() => {
                    void onExportGraphPng()
                  }}
                >
                  {t('knowledge.graph.exportPng')}
                </button>
                <button
                  type="button"
                  className="kos-graph-text-btn kos-graph-more-menu-action"
                  data-testid="kos-graph-preset-save"
                  onClick={onSaveGraphPreset}
                >
                  {t('knowledge.graph.presetSave')}
                </button>
                {presetFeedback ? (
                  <p className="kos-graph-preset-feedback" data-testid="kos-graph-preset-feedback">
                    {presetFeedback}
                  </p>
                ) : null}
                {graphPresets.length > 0 ? (
                  <div className="kos-graph-preset-list" role="group" aria-label={t('knowledge.graph.presetListAria')}>
                    {graphPresets.map((preset) => (
                      <div key={preset.id} className="kos-graph-preset-row">
                        <button
                          type="button"
                          className="kos-graph-text-btn kos-graph-more-menu-action kos-graph-preset-apply"
                          data-testid={`kos-graph-preset-${preset.id}`}
                          onClick={() => onApplyGraphPreset(preset)}
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          className="kos-graph-preset-delete"
                          aria-label={t('knowledge.graph.presetDeleteAria', { name: preset.name })}
                          data-testid={`kos-graph-preset-delete-${preset.id}`}
                          onClick={() => onDeleteGraphPreset(preset.id)}
                        >
                          <Icon name="delete" size={14} tone="muted" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>,
              document.body,
            )
          : null}
        {!interactionHintDismissed ? (
          <div className="kos-graph-interaction-hint" data-testid="kos-graph-interaction-hint">
            <span className="kos-graph-interaction-hint-text">
              {interactionHintExpanded
                ? `${t('knowledge.graph.interactionHintPrimary')} ${t('knowledge.graph.interactionHintAdvanced')}`
                : t('knowledge.graph.interactionHintPrimary')}
            </span>
            <button
              type="button"
              className="kos-graph-interaction-hint-more"
              data-testid="kos-graph-interaction-hint-more"
              onClick={() => setInteractionHintExpanded((expanded) => !expanded)}
            >
              {interactionHintExpanded
                ? t('knowledge.graph.interactionHintLess')
                : t('knowledge.graph.interactionHintMore')}
            </button>
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
        <div className="kos-graph-stage" ref={graphStageRef} tabIndex={0}>
          {selectedEdgeId ? (
            <div className="kos-graph-edge-selection-bar" data-testid="kos-graph-edge-selection-bar">
              <span className="kos-graph-edge-selection-label">{t('knowledge.graph.unlinkEdgeHint')}</span>
              <button
                type="button"
                className="kos-graph-text-btn"
                data-testid="kos-graph-edge-unlink"
                onClick={() => {
                  void deleteSelectedEdge()
                }}
              >
                {t('knowledge.graph.unlinkEdge')}
              </button>
            </div>
          ) : null}
          <svg
            className={`kos-graph-svg${isPanning ? ' is-panning' : ''}${isLinkDragging ? ' is-link-dragging' : ''}${isNodeDragging ? ' is-node-dragging' : ''}`}
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
            <defs>
              <marker
                id={`${centerGlowFilterId}-edge-arrow`}
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="7.5"
                markerHeight="7.5"
                markerUnits="userSpaceOnUse"
                orient="auto"
                overflow="visible"
              >
                <path d="M2 2.2 L8.5 5 L2 7.8 Z" className="kos-graph-edge-marker-path" />
              </marker>
              <marker
                id={`${centerGlowFilterId}-edge-arrow-selected`}
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto"
                overflow="visible"
              >
                <path
                  d="M2 2.2 L8.5 5 L2 7.8 Z"
                  className="kos-graph-edge-marker-path kos-graph-edge-marker-path--selected"
                />
              </marker>
              <marker
                id={`${centerGlowFilterId}-edge-arrow-embed`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6.5"
                markerHeight="6.5"
                markerUnits="userSpaceOnUse"
                orient="auto"
                overflow="visible"
              >
                <path
                  d="M2.2 2.4 L8 5 L2.2 7.6 Z"
                  className="kos-graph-edge-marker-path kos-graph-edge-marker-path--embed"
                />
              </marker>
              <filter
                id={centerGlowFilterId}
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g
              ref={graphGroupRef}
              className="kos-graph-world"
              transform={`translate(${x + W / 2}, ${y + H / 2}) scale(${zoom})`}
            >
              {renderEdges.map((edge) => {
                const a = nodeById.get(edge.from)
                const b = nodeById.get(edge.to)
                if (!a || !b) return null
                const isSelected = selectedEdgeId === edge.id
                const fromRadius = graphNodeRadius(
                  a,
                  referenceCountByNodeId.get(a.id) ?? 0,
                  displayHighlightId === a.id,
                )
                const toRadius = graphNodeRadius(
                  b,
                  referenceCountByNodeId.get(b.id) ?? 0,
                  displayHighlightId === b.id,
                )
                const trimmed = trimGraphEdgeEndpoints(a, b, fromRadius, toRadius)
                const edgeCurveMeta = edgeCurveMetaById.get(edge.id)
                const edgePath = buildGraphEdgeCurvePath(
                  trimmed.x1,
                  trimmed.y1,
                  trimmed.x2,
                  trimmed.y2,
                  edge.id,
                  edgeCurveMeta,
                )
                const hitPath = buildGraphEdgeCurvePath(a.x, a.y, b.x, b.y, edge.id, edgeCurveMeta)
                const isUnresolvedEdge = a.status === 'unresolved' || b.status === 'unresolved'
                const edgeMarkerId =
                  isSelected
                    ? `${centerGlowFilterId}-edge-arrow-selected`
                    : edge.kind === 'embed'
                      ? `${centerGlowFilterId}-edge-arrow-embed`
                      : `${centerGlowFilterId}-edge-arrow`
                const edgeClassName = [
                  'kos-graph-edge',
                  `kos-graph-edge--${edge.kind}`,
                  isUnresolvedEdge ? 'kos-graph-edge--unresolved' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <g
                    key={edge.id}
                    className={`kos-graph-edge-group${isSelected ? ' is-selected' : ''}`}
                    data-graph-edge-id={edge.id}
                    data-graph-edge-unresolved={isUnresolvedEdge ? 'true' : undefined}
                  >
                    <path
                      d={hitPath}
                      className="kos-graph-edge-hit"
                      data-testid={`kos-graph-edge-hit-${edge.id}`}
                      onPointerDown={(e) => onEdgePointerDown(edge, e)}
                      onDoubleClick={(e) => onEdgeDoubleClick(edge, e)}
                    />
                    {isSelected ? (
                      <path
                        d={edgePath}
                        className="kos-graph-edge-glow"
                        pointerEvents="none"
                      />
                    ) : null}
                    <path
                      d={edgePath}
                      className={edgeClassName}
                      markerEnd={`url(#${edgeMarkerId})`}
                      pointerEvents="none"
                    />
                  </g>
                )
              })}
              {linkDragPreview ? (
                <line
                  x1={linkDragPreview.x1}
                  y1={linkDragPreview.y1}
                  x2={linkDragPreview.x2}
                  y2={linkDragPreview.y2}
                  className="kos-graph-edge kos-graph-edge--preview"
                  data-testid="kos-graph-link-preview"
                />
              ) : null}
              {renderNodes.map((n) => {
                const isRouteCenter = routeCenterNode?.id === n.id
                const isHighlighted = displayHighlightId === n.id
                const nodeReferenceCount = referenceCountByNodeId.get(n.id) ?? 0
                const nodeRadius = graphNodeRadius(n, nodeReferenceCount, isHighlighted)
                const useFolderColor =
                  graphFilters.colorByFolder && n.status !== 'unresolved' && !n.id.startsWith('heading:')
                const useTagColor =
                  graphFilters.colorByTag && n.status !== 'unresolved' && !n.id.startsWith('heading:')
                const folderColor = useFolderColor ? graphFolderColor(graphFolderKeyFromDocKey(n.docKey)) : undefined
                const tagColor = useTagColor ? graphPrimaryTagColor(n.docKey) : undefined
                const accentColor = tagColor ?? folderColor
                const nodeStyle = accentColor
                  ? ({ '--kos-graph-folder-color': accentColor } as CSSProperties)
                  : undefined
                const labelDisplay = resolveGraphNodeLabelDisplay(n.label, zoom, {
                  isHighlighted,
                  isRouteCenter,
                  isDenseGraph,
                  isHeadingNode: n.id.startsWith('heading:'),
                  alwaysShowLabels: graphFilters.alwaysShowLabels,
                })
                const isLinkDropTarget = linkDropTargetId === n.id
                const isDraggingThisNode = draggingNodePos?.id === n.id
                const isNodeInteractive = n.navigable || n.status === 'unresolved'
                const isSearchMatch = searchMatchIdSet.has(n.id)
                const isSearchFocused = searchFocusedNodeId === n.id
                return (
                  <g
                    key={n.id}
                    data-graph-node-id={n.id}
                    data-graph-node-radius={nodeRadius}
                    style={nodeStyle}
                    className={`kos-graph-node${isHighlighted ? ' kos-graph-node--selected' : ''}${isRouteCenter ? ' kos-graph-node--center' : ''}${isSearchMatch ? ' kos-graph-node--search-match' : ''}${isSearchFocused ? ' kos-graph-node--search-focus' : ''}${useFolderColor || useTagColor ? ' kos-graph-node--folder-colored' : ''}${n.status === 'unresolved' ? ' kos-graph-node--unresolved' : ''}${n.navigable ? ' kos-graph-node--navigable' : ''}${isNodeInteractive ? ' kos-graph-node--interactive' : ''}${isLinkDropTarget ? ' kos-graph-node--link-drop-target' : ''}${isDraggingThisNode ? ' kos-graph-node--dragging' : ''}`}
                    transform={`translate(${n.x}, ${n.y})`}
                    onMouseEnter={(e) => onNodeMouseEnter(n, e)}
                    onMouseMove={onNodeMouseMove}
                    onMouseLeave={onNodeMouseLeave}
                    onPointerDown={isNodeInteractive ? (e) => onNodePointerDown(n, e) : undefined}
                    onClick={isNodeInteractive ? onNodeClick : undefined}
                    onDoubleClick={isNodeInteractive ? (e) => onNodeDoubleClick(n, e) : undefined}
                  >
                    {isHighlighted ? (
                      <>
                        <circle
                          r={nodeRadius + 9}
                          className="kos-graph-node-halo kos-graph-node-halo--outer"
                        />
                        <circle
                          r={nodeRadius + 3}
                          fill="none"
                          className="kos-graph-node-ring"
                        />
                      </>
                    ) : null}
                    <circle
                      r={nodeRadius}
                      className="kos-graph-node-dot"
                      filter={isHighlighted ? `url(#${centerGlowFilterId})` : undefined}
                    />
                    {labelDisplay.visible ? (
                      <text
                        y={
                          nodeRadius +
                          (isRouteCenter ? 16 : 10) +
                          (isHighlighted ? 8 : 0)
                        }
                        textAnchor="middle"
                        className="kos-graph-node-label"
                      >
                        {labelDisplay.text}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          </svg>
          {showNodeLegend ? (
            <div
              className="kos-graph-folder-legend"
              role="list"
              aria-label={t('knowledge.graph.nodeLegendAria')}
              data-testid="kos-graph-node-legend"
            >
              {folderLegendEntries.map(({ folderKey, color }) => (
                <span
                  key={folderKey || '__root'}
                  className="kos-graph-folder-legend-item"
                  role="listitem"
                >
                  <span
                    className="kos-graph-folder-legend-swatch"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{folderKey || t('knowledge.graph.folderRoot')}</span>
                </span>
              ))}
              {graphFilters.showUnresolved ? (
                <span className="kos-graph-folder-legend-item" role="listitem">
                  <span
                    className="kos-graph-folder-legend-swatch kos-graph-folder-legend-swatch--unresolved"
                    aria-hidden="true"
                  />
                  <span>{t('knowledge.graph.legendUnresolved')}</span>
                </span>
              ) : null}
              {graphFilters.showHeadingNodes ? (
                <span className="kos-graph-folder-legend-item" role="listitem">
                  <span
                    className="kos-graph-folder-legend-swatch kos-graph-folder-legend-swatch--heading"
                    aria-hidden="true"
                  />
                  <span>{t('knowledge.graph.legendHeading')}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {nodeHover ? (
            <div
              className="kos-graph-tooltip"
              style={clampGraphTooltipPosition(nodeHover.clientX, nodeHover.clientY)}
              role="tooltip"
            >
              <div className="kos-graph-tooltip-title">{nodeHover.label}</div>
              {nodeHover.preview ? (
                <div className="kos-graph-tooltip-preview">{nodeHover.preview}</div>
              ) : null}
              {nodeHover.tags.length > 0 ? (
                <div className="kos-graph-tooltip-tags">
                  {nodeHover.tags.slice(0, 4).map((tag) => `#${tag}`).join(' · ')}
                </div>
              ) : null}
              <div className="kos-graph-tooltip-meta">
                {nodeHover.isHeadingNode ? `${t('knowledge.graph.legendHeading')} · ` : ''}
                {nodeHover.folderKey ? `${nodeHover.folderKey} · ` : ''}
                {t('knowledge.graph.nodeTooltipDegree', {
                  incoming: nodeHover.incomingCount,
                  outgoing: nodeHover.outgoingCount,
                })}
                {nodeHover.status === 'unresolved'
                  ? ` · ${t('knowledge.graph.nodeTooltipUnresolved')}`
                  : null}
              </div>
              {(nodeHover.referenceCount >= GRAPH_HUB_EXPAND_DEGREE || snap.graphLimit) &&
              nodeHover.id.startsWith('page:') ? (
                <button
                  type="button"
                  className="kos-graph-tooltip-action"
                  data-testid="kos-graph-expand-hub"
                  onClick={onExpandHoveredHub}
                >
                  {t('knowledge.graph.expandHub')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {fullscreenOpen && centerDocKey && !isFullscreenLayout ? (
        <GraphFullscreenOverlay
          centerDocKey={centerDocKey}
          onClose={onCloseGraphFullscreen}
        />
      ) : null}
      <GraphPresetSaveDialog
        open={presetSaveOpen}
        title={t('knowledge.graph.presetSave')}
        label={t('knowledge.graph.presetNamePrompt')}
        saveLabel={t('app.unsaved.save')}
        cancelLabel={t('app.rename.cancel')}
        saveError={presetSaveError}
        onClose={onClosePresetSaveDialog}
        onSave={onConfirmGraphPresetSave}
      />
    </div>
  )
}
