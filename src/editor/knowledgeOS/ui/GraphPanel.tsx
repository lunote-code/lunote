import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { Icon } from '../../../design-system/icons'
import { useGraphSlice } from './useKnowledgeOSSlice'
import { dispatchKnowledgeNavigate } from './interactionTransaction'
import { useSurfaceLayout } from './useSurfaceLayout'
import { useFrozenSurfaceLayout } from './useFrozenSurfaceLayout'
import { useGraphViewportLive } from './useGraphViewportLive'
import { isSurfaceResizing } from '../layout/surfaceSplitLayoutRuntime'
import {
  buildGraphNodeSpatialIndex,
  findGraphNodeAtScreen,
  type GraphViewportTransform,
} from '../layout/graphHitTest'
import { useHostLayoutFallback } from './useHostLayoutFallback'
import {
  flushPendingGraphNavigationCenter,
  flushPendingGraphCenterWhenReady,
} from '../graphNavigationRuntime'
import {
  getActiveGraphNodeId,
  getNodeActivationRenderState,
  subscribeActiveGraphNode,
  subscribeNodeActivationRenderState,
} from '../graphNodeActivationRuntime'
import { useGraphNodeRenderStability } from './useGraphNodeRenderStability'
import {
  notifyGraphLayoutReady,
  notifyGraphLayoutUnavailable,
} from '../graphReadinessRuntime'
import { resolveRouteCenterNode, setGraphInteracting, syncNoteGraphTopologyFromRoute } from '../noteGraphRuntime'
import { setGraphViewportIntent } from '../graphViewportRuntime'
import { resolveClickIntent } from '../../navigation/clickIntentResolver'
import { normalizeDocKeyForNavigation } from '../../knowledgeRuntime'
import type { NoteGraphNode } from '../types'
import { useI18n } from '../../../i18n'

type Props = {
  /** Route SSOT：workspace activeDocKey */
  centerDocKey: string | null
}

const NODE_HIT_RADIUS = 24
const MIN_TRUSTED_LAYOUT_PX = 48
const loggedGraphRenderKeys = new Set<string>()
const MAX_LOGGED_GRAPH_RENDER_KEYS = 2000

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

function preventGraphTextSelection(e: React.MouseEvent<SVGSVGElement>): void {
  e.preventDefault()
}

export function GraphPanel({ centerDocKey }: Props) {
  const { t } = useI18n()
  const snap = useGraphSlice()
  const hostRef = useRef<HTMLDivElement>(null)
  const graphGroupRef = useRef<SVGGElement>(null)
  const layout = useSurfaceLayout('graph', hostRef)
  const layoutWithHostFallback = useHostLayoutFallback(hostRef, layout)
  const frozenLayout = useFrozenSurfaceLayout(layoutWithHostFallback)
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
  const agentLogEnabled = isAgentLogEnabled()

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
    syncNoteGraphTopologyFromRoute(centerDocKey, { depth: 2 })
  }, [centerDocKey])

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

  const onClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const traceId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const hit = findGraphNodeAtScreen(
        e.clientX,
        e.clientY,
        graphGroupRef.current,
        snap.nodes,
        NODE_HIT_RADIUS,
        nodeSpatialIndex,
        viewportHitFallback,
      )
      const normalizedHit = hit
        ? {
            ...hit,
            docKey: normalizeDocKeyForNavigation(hit.docKey),
            heading: hit.id.startsWith('heading:') ? hit.label : undefined,
          }
        : null
      const intent = resolveClickIntent({
        type: 'graph',
        event: e,
        uiDisabled: false,
        hitTestResult: normalizedHit,
        meta: {
          nodeId: normalizedHit?.id,
          nodeDocKey: normalizedHit?.docKey,
          nodeStatus: normalizedHit?.status,
        },
      })
      if (agentLogEnabled) {
        // #region agent log
        console.debug('[graph-node-click]', { traceId, nodeId: normalizedHit?.id ?? null, docKey: normalizedHit?.docKey ?? null, label: normalizedHit?.label ?? null, status: normalizedHit?.status ?? null, navigable: normalizedHit?.navigable ?? false })
        console.debug('[graph-node-dom-click]', { traceId, docKey: normalizedHit?.docKey ?? null, resolvedPath: null, root: null, eventType: null, commandType: null, clientX: e.clientX, clientY: e.clientY, hitId: normalizedHit?.id ?? null, allowDispatch: intent.allowDispatch, reason: intent.reason })
        // #endregion
      }
      dispatchKnowledgeNavigate('graph', { intent, hit: normalizedHit, traceId })
    },
    [agentLogEnabled, nodeSpatialIndex, snap.nodes, viewportHitFallback],
  )

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
  }, [])

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
      pendingZoomRef.current *= e.deltaY > 0 ? 0.92 : 1.08
      scheduleWheelZoomFlush()
    },
    [scheduleWheelZoomFlush],
  )

  if (!centerDocKey) {
    return (
      <div className="kos-surface-host kos-surface-host--empty" ref={hostRef}>
        <Icon name="graph" size="display" tone="muted" />
        <p className="kos-panel-empty">{t('knowledge.graph.emptyDoc')}</p>
      </div>
    )
  }

  return (
    <div className="kos-surface-host" ref={hostRef}>
      <div className={`kos-graph-panel${resizing ? ' kos-graph-panel--resizing' : ''}`}>
        <p className="kos-panel-muted kos-graph-hint">{t('knowledge.graph.hint', { depth: snap.depth })}</p>
        <div className="kos-graph-stage">
          <svg
            className="kos-graph-svg"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            onClick={onClick}
            onMouseDown={preventGraphTextSelection}
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
                const renderLogKey = `${snap.revision}:${n.id}:${n.docKey}`
                if (!loggedGraphRenderKeys.has(renderLogKey)) {
                  if (loggedGraphRenderKeys.size >= MAX_LOGGED_GRAPH_RENDER_KEYS) {
                    loggedGraphRenderKeys.clear()
                  }
                  loggedGraphRenderKeys.add(renderLogKey)
                  const nodeRecord = n as NoteGraphNode & { path?: string; slug?: string; sourceProjection?: string }
                  const clickable = n.navigable
                  if (agentLogEnabled) {
                    // #region agent log
                    console.debug('[graph-node-render]', { traceId: `graph-render-${snap.revision}`, nodeId: n.id, docKey: n.docKey, label: n.label, status: n.status, clickable, nodePath: nodeRecord.path ?? null, nodeSlug: nodeRecord.slug ?? null, sourceProjection: nodeRecord.sourceProjection ?? 'noteGraphRuntime', centerDocKey, revision: snap.revision })
                    // #endregion
                  }
                }
                return (
                  <g
                    key={n.id}
                    data-graph-node-id={n.id}
                    className={`kos-graph-node${isHighlighted ? ' kos-graph-node--selected' : ''}${isRouteCenter ? ' kos-graph-node--center' : ''}${n.status === 'unresolved' ? ' kos-graph-node--unresolved' : ''}`}
                    transform={`translate(${n.x}, ${n.y})`}
                  >
                    <circle
                      r={isRouteCenter ? 10 : 7}
                      className="kos-graph-node-dot"
                    />
                    <text y={18} textAnchor="middle" className="kos-graph-node-label">
                      {n.label.length > 14 ? `${n.label.slice(0, 12)}…` : n.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
