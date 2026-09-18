import type { MouseEvent } from 'react'
import { normalizeDocKeyForNavigation } from '../../knowledgeRuntime'
import { resolveClickIntent } from '../../navigation/clickIntentResolver'
import type { DocKey } from '../../knowledgeRuntime/types'
import type { NoteGraphNode } from '../types'
import { findGraphNodeAtScreen, type GraphNodeSpatialIndex, type GraphViewportTransform } from '../layout/graphHitTest'
import { resolveUnresolvedGraphNodeNavigation } from '../graphUnresolvedNavigation'
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

export function noteGraphNodeAsHit(n: NoteGraphNode): NoteGraphNode {
  return {
    ...n,
    docKey: normalizeDocKeyForNavigation(n.docKey),
    heading: n.id.startsWith('heading:') ? n.label : undefined,
  }
}

function dispatchGraphNavigateFromHit(
  e: MouseEvent,
  hit: NoteGraphNode,
  preferredSourceDocKey?: DocKey | null,
): void {
  const traceId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const intent = resolveClickIntent({
    type: 'graph',
    event: e,
    uiDisabled: false,
    hitTestResult: hit,
    meta: {
      nodeId: hit.id,
      nodeDocKey: hit.docKey,
      nodeStatus: hit.status,
    },
  })
  if (!intent.allowDispatch) return

  if (hit.status === 'unresolved') {
    const source = resolveUnresolvedGraphNodeNavigation(hit, preferredSourceDocKey)
    if (!source) return
    dispatchKnowledgeNavigate('graph', {
      intent,
      hit: {
        docKey: source.docKey,
        heading: source.heading,
        linkBodyOffset: source.linkBodyOffset,
      },
      traceId,
    })
    return
  }

  dispatchKnowledgeNavigate('graph', { intent, hit, traceId })
}

export function navigateGraphNodeFromRenderedNode(
  e: MouseEvent,
  n: NoteGraphNode,
  preferredSourceDocKey?: DocKey | null,
): void {
  navigateGraphNodeFromHit(e, noteGraphNodeAsHit(n), preferredSourceDocKey)
}

export function navigateGraphNodeFromHit(
  e: MouseEvent,
  hit: NoteGraphNode | null,
  preferredSourceDocKey?: DocKey | null,
): void {
  if (!hit) return
  dispatchGraphNavigateFromHit(e, hit, preferredSourceDocKey)
}
