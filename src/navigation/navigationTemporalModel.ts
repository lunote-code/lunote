import type { NavigationEvent } from './navigationEventTypes'

export type NavigationDependencyType = 'causal' | 'independent' | 'conflict'

export type NavigationTemporalNode = {
  eventId: string
  event: NavigationEvent
  prevEventId?: string
  nextEventId?: string
  dependencyType: NavigationDependencyType
}

export type NavigationTemporalAnomaly = {
  type:
    | 'out_of_order'
    | 'overlap'
    | 'restore_overwrite'
    | 'cross_interruption'
  eventId: string
  relatedEventId?: string
  detail: string
}

const nodes = new Map<string, NavigationTemporalNode>()
const sequence: string[] = []
const anomalies: NavigationTemporalAnomaly[] = []

function targetKey(event: NavigationEvent): string | null {
  return event.path ?? event.docKey ?? null
}

function isNavigationEvent(event: NavigationEvent): boolean {
  return event.type === 'OPEN_NOTE' || event.type === 'OPEN_IN_TAB'
}

function isKnowledgeFocusEvent(event: NavigationEvent): boolean {
  return event.type === 'GRAPH_FOCUS' || event.type === 'BACKLINK_FOCUS'
}

function dependencyBetween(prev: NavigationEvent | null, next: NavigationEvent): NavigationDependencyType {
  if (!prev) return 'independent'
  if (prev.type === 'RESTORE' && isNavigationEvent(next)) return 'causal'
  if (targetKey(prev) && targetKey(prev) === targetKey(next)) return 'causal'
  if (isNavigationEvent(prev) && isNavigationEvent(next)) return 'conflict'
  if (isKnowledgeFocusEvent(prev) && isKnowledgeFocusEvent(next) && targetKey(prev) !== targetKey(next)) {
    return 'conflict'
  }
  return 'independent'
}

function pushAnomaly(anomaly: NavigationTemporalAnomaly): void {
  anomalies.push(anomaly)
}

function detectAnomalies(prev: NavigationTemporalNode | null, node: NavigationTemporalNode): void {
  const prevEvent = prev?.event ?? null
  const event = node.event
  if (!prevEvent) return

  if (prevEvent.timestamp > event.timestamp) {
    pushAnomaly({
      type: 'out_of_order',
      eventId: event.id,
      relatedEventId: prevEvent.id,
      detail: 'Timeline append order disagrees with event timestamp order.',
    })
  }

  if (isNavigationEvent(prevEvent) && isNavigationEvent(event) && targetKey(prevEvent) !== targetKey(event)) {
    pushAnomaly({
      type: 'overlap',
      eventId: event.id,
      relatedEventId: prevEvent.id,
      detail: 'Consecutive open navigation events target different documents.',
    })
  }

  if (prevEvent.type === 'RESTORE' && isNavigationEvent(event) && targetKey(prevEvent) && targetKey(prevEvent) !== targetKey(event)) {
    pushAnomaly({
      type: 'restore_overwrite',
      eventId: event.id,
      relatedEventId: prevEvent.id,
      detail: 'Navigation event overwrote restored active target before restore chain settled.',
    })
  }

  if (
    isKnowledgeFocusEvent(prevEvent) &&
    isKnowledgeFocusEvent(event) &&
    prevEvent.type !== event.type &&
    targetKey(prevEvent) !== targetKey(event)
  ) {
    pushAnomaly({
      type: 'cross_interruption',
      eventId: event.id,
      relatedEventId: prevEvent.id,
      detail: 'Graph/backlink focus events interrupted each other across different targets.',
    })
  }
}

export function recordNavigationTemporalEvent(event: NavigationEvent): NavigationTemporalNode {
  const prevId = sequence[sequence.length - 1]
  const prev = prevId ? nodes.get(prevId) ?? null : null
  const dependencyType = dependencyBetween(prev?.event ?? null, event)
  const node: NavigationTemporalNode = {
    eventId: event.id,
    event,
    prevEventId: prev?.eventId,
    dependencyType,
  }

  if (prev) {
    prev.nextEventId = event.id
  }

  nodes.set(event.id, node)
  sequence.push(event.id)

  detectAnomalies(prev, node)
  return node
}

export function getNavigationTemporalChain(): NavigationTemporalNode[] {
  return sequence.map((id) => nodes.get(id)).filter((node): node is NavigationTemporalNode => Boolean(node))
}

export function getNavigationTemporalAnomalies(): NavigationTemporalAnomaly[] {
  return [...anomalies]
}

export function resetNavigationTemporalModel(): void {
  nodes.clear()
  sequence.length = 0
  anomalies.length = 0
}
