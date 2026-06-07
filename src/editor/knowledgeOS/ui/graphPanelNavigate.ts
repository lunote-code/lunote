import type { MouseEvent } from 'react'
import { normalizeDocKeyForNavigation } from '../../knowledgeRuntime'
import { resolveClickIntent } from '../../navigation/clickIntentResolver'
import type { NoteGraphNode } from '../types'
import { findGraphNodeAtScreen, type GraphNodeSpatialIndex, type GraphViewportTransform } from '../layout/graphHitTest'
import { dispatchKnowledgeNavigate } from './interactionTransaction'

export function hitGraphNodeAtEvent(
  e: { clientX: number; clientY: number },
  graphGroup: SVGGElement | null,
  nodes: readonly NoteGraphNode[],
  nodeSpatialIndex: GraphNodeSpatialIndex,
  viewport: GraphViewportTransform,
  hitRadius: number,
): NoteGraphNode | null {
  const hit = findGraphNodeAtScreen(
    e.clientX,
    e.clientY,
    graphGroup,
    nodes,
    hitRadius,
    nodeSpatialIndex,
    viewport,
  )
  if (!hit) return null
  return {
    ...hit,
    docKey: normalizeDocKeyForNavigation(hit.docKey),
    heading: hit.id.startsWith('heading:') ? hit.label : undefined,
  }
}

export function navigateGraphNodeFromHit(
  e: MouseEvent,
  hit: NoteGraphNode | null,
  agentLogEnabled: boolean,
): void {
  const traceId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const intent = resolveClickIntent({
    type: 'graph',
    event: e,
    uiDisabled: false,
    hitTestResult: hit,
    meta: {
      nodeId: hit?.id,
      nodeDocKey: hit?.docKey,
      nodeStatus: hit?.status,
    },
  })
  if (agentLogEnabled && hit) {
    console.debug('[graph-node-click]', {
      traceId,
      nodeId: hit.id,
      docKey: hit.docKey,
      label: hit.label,
      status: hit.status,
      navigable: hit.navigable,
    })
  }
  dispatchKnowledgeNavigate('graph', { intent, hit, traceId })
}
