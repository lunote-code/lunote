import type { NavigationEvent, NavigationEventSource, NavigationEventType } from './navigationEventTypes'
import {
  getNavigationCausalNode,
  recordNavigationCausalEffect,
} from './navigationCausalGraph'
import {
  getNavigationTemporalAnomalies,
  getNavigationTemporalChain,
} from './navigationTemporalModel'

export type NavigationActualSideEffect = {
  id: string
  kind: string
  source: NavigationEventSource
  path?: string
  docKey?: string
  timestamp: number
  meta?: Record<string, unknown>
}

type NavigationMismatch = {
  type: 'missing' | 'duplicate' | 'reorder' | 'unexpected'
  eventId?: string
  eventType?: NavigationEventType
  sideEffectKind?: string
  detail: string
}

function logRootCause(eventId: string | null, mismatches: readonly NavigationMismatch[]): void {
  if (mismatches.length === 0) return
  void eventId
  void getNavigationCausalNode
  void getNavigationTemporalAnomalies
  void getNavigationTemporalChain
}

const expectedByEvent = new Map<string, Set<string>>()
const actualByEvent = new Map<string, NavigationActualSideEffect[]>()
const eventOrder: string[] = []
const actualOrder: string[] = []
let actualSeq = 0
let activeNavigationEventId: string | null = null

export function expectedSideEffectsForEvent(event: NavigationEvent): string[] {
  switch (event.type) {
    case 'OPEN_NOTE':
      if (event.meta?.interactionSource) {
        return ['dispatchKnowledgeNavigate', 'kernelNavigate', 'openAbsolutePath']
      }
      return ['dispatchDocumentCommand', 'notifyKnowledgeDocumentOpen']
    case 'OPEN_IN_TAB':
      return ['dispatchDocumentCommand', 'revealNavigationAnchor']
    case 'REVEAL':
      return ['revealNavigationAnchor']
    case 'GRAPH_FOCUS':
      return ['dispatchKnowledgeNavigate', 'kernelNavigate', 'openAbsolutePath']
    case 'BACKLINK_FOCUS':
      return ['dispatchKnowledgeNavigate', 'kernelNavigate', 'openAbsolutePath']
    case 'RESTORE':
      return ['loadWorkspaceSnapshot', 'restoreTabs', 'restoreActivePath']
    default:
      return []
  }
}

export function registerNavigationEvent(event: NavigationEvent): void {
  expectedByEvent.set(event.id, new Set(expectedSideEffectsForEvent(event)))
  eventOrder.push(event.id)
  validateNavigationEvent(event)
}

export function setActiveNavigationEvent(eventId: string | null): void {
  activeNavigationEventId = eventId
}

export function getActiveNavigationEvent(): string | null {
  return activeNavigationEventId
}

export function recordNavigationSideEffect(
  eventId: string | null,
  effect: Omit<NavigationActualSideEffect, 'id' | 'timestamp'> & { timestamp?: number },
): void {
  actualSeq += 1
  const actual: NavigationActualSideEffect = {
    ...effect,
    id: `nav-actual-${Date.now()}-${actualSeq}`,
    timestamp: effect.timestamp ?? Date.now(),
  }
  if (eventId) {
    const list = actualByEvent.get(eventId) ?? []
    list.push(actual)
    actualByEvent.set(eventId, list)
    actualOrder.push(eventId)
  } else {
    actualOrder.push(`unexpected:${actual.id}`)
  }
  validateNavigationSideEffect(eventId, actual)
}

export function validateNavigationEvent(event: NavigationEvent): NavigationMismatch[] {
  const expected = expectedByEvent.get(event.id) ?? new Set()
  const actual = actualByEvent.get(event.id) ?? []
  const actualKinds = new Set(actual.map((item) => item.kind))
  const mismatches: NavigationMismatch[] = []

  for (const kind of expected) {
    if (!actualKinds.has(kind)) {
      mismatches.push({
        type: 'missing',
        eventId: event.id,
        eventType: event.type,
        sideEffectKind: kind,
        detail: `Expected side effect "${kind}" has not been observed yet.`,
      })
    }
  }

  for (const item of actual) {
    const count = actual.filter((candidate) => candidate.kind === item.kind).length
    if (count > 1) {
      mismatches.push({
        type: 'duplicate',
        eventId: event.id,
        eventType: event.type,
        sideEffectKind: item.kind,
        detail: `Side effect "${item.kind}" was observed ${count} times.`,
      })
    }
    if (!expected.has(item.kind)) {
      mismatches.push({
        type: 'unexpected',
        eventId: event.id,
        eventType: event.type,
        sideEffectKind: item.kind,
        detail: `Unexpected side effect "${item.kind}" for event "${event.type}".`,
      })
    }
  }

  if (mismatches.length > 0) logRootCause(event.id, mismatches)

  return mismatches
}

export function validateNavigationSideEffect(
  eventId: string | null,
  actual: NavigationActualSideEffect,
): NavigationMismatch[] {
  if (!eventId || !expectedByEvent.has(eventId)) {
    const mismatch: NavigationMismatch = {
      type: 'unexpected',
      sideEffectKind: actual.kind,
      detail: `Actual side effect "${actual.kind}" does not map to a known navigation event.`,
    }
    recordNavigationCausalEffect(eventId, actual)
    logRootCause(eventId, [mismatch])
    return [mismatch]
  }

  recordNavigationCausalEffect(eventId, actual)

  const expected = expectedByEvent.get(eventId)!
  const eventIndex = eventOrder.indexOf(eventId)
  const lastKnownEventIndex = actualOrder
    .filter((id) => !id.startsWith('unexpected:'))
    .map((id) => eventOrder.indexOf(id))
    .filter((index) => index >= 0)
    .at(-2)

  const mismatches: NavigationMismatch[] = []
  if (!expected.has(actual.kind)) {
    mismatches.push({
      type: 'unexpected',
      eventId,
      sideEffectKind: actual.kind,
      detail: `Unexpected side effect "${actual.kind}" for event ${eventId}.`,
    })
  }
  if (lastKnownEventIndex != null && eventIndex < lastKnownEventIndex) {
    mismatches.push({
      type: 'reorder',
      eventId,
      sideEffectKind: actual.kind,
      detail: `Side effect "${actual.kind}" was observed after a later timeline event.`,
    })
  }

  if (mismatches.length > 0) {
    logRootCause(eventId, mismatches)
  }

  return mismatches
}
