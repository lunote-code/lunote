import { notifyNavigationShadowScheduler } from './navigationScheduler'
import { applyNavigationEvent } from './navigationStateMachine'
import {
  assertNavigationFactoryCaller,
  validateNavigationEvent,
} from './navigationEventTypes'
import type { NavigationEvent } from './navigationEventTypes'

export type NavigationTimeline = {
  events: NavigationEvent[]
  pointer: number
}

let seq = 0
const timeline: NavigationTimeline = {
  events: [],
  pointer: -1,
}

export function createNavigationEvent(
  event: Omit<NavigationEvent, 'id' | 'timestamp' | '__source'> & { timestamp?: number },
): NavigationEvent {
  assertNavigationFactoryCaller()
  seq += 1
  return {
    ...event,
    __source: 'navigationFactory',
    id: `nav-${Date.now()}-${seq}`,
    timestamp: event.timestamp ?? Date.now(),
  }
}

export function appendEvent(event: NavigationEvent): NavigationEvent {
  validateNavigationEvent(event)
  timeline.events.push(event)
  timeline.pointer = timeline.events.length - 1
  applyNavigationEvent(event)
  notifyNavigationShadowScheduler(event, getTimeline())
  return event
}

export function getTimeline(): NavigationTimeline {
  return {
    events: [...timeline.events],
    pointer: timeline.pointer,
  }
}

export function replayTimeline(): readonly NavigationEvent[] {
  return getTimeline().events
}

export function resetNavigationTimeline(): void {
  timeline.events.length = 0
  timeline.pointer = -1
  seq = 0
}
