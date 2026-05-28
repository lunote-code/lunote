import type { NavigationEvent } from './navigationEventTypes'
import { startNavigationCausalTrace } from './navigationCausalGraph'
import { recordNavigationTemporalEvent } from './navigationTemporalModel'
import {
  expectedSideEffectsForEvent,
  registerNavigationEvent,
  validateNavigationEvent,
} from './navigationEventValidator'

type NavigationTimelineSnapshot = {
  events: readonly NavigationEvent[]
  pointer: number
}

export function notifyNavigationShadowScheduler(
  event: NavigationEvent,
  timeline: NavigationTimelineSnapshot,
): void {
  registerNavigationEvent(event)
  startNavigationCausalTrace(event, expectedSideEffectsForEvent(event))
  recordNavigationTemporalEvent(event)
  console.log('[NAV DIFF] event received', {
    id: event.id,
    type: event.type,
    source: event.source,
    path: event.path,
    docKey: event.docKey,
    pointer: timeline.pointer,
    eventCount: timeline.events.length,
  })
  console.log('[NAV DIFF] expected vs actual', {
    id: event.id,
    type: event.type,
    mode: 'diff',
    expectedSideEffects: expectedSideEffectsForEvent(event),
    mismatchCount: validateNavigationEvent(event).length,
  })
}

export function processEvent(event: NavigationEvent): void {
  notifyNavigationShadowScheduler(event, {
    events: [event],
    pointer: 0,
  })
}

export function runSideEffects(event: NavigationEvent): void {
  void event
}
