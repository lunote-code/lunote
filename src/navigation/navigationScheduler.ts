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
  void timeline
  validateNavigationEvent(event)
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
