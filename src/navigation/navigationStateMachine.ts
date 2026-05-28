import type { NavigationEvent } from './navigationEventTypes'

export type NavigationState =
  | 'idle'
  | 'observed'

export type NavigationMachineContext = {
  state: NavigationState
  currentEventId: string | null
  activePath: string | null
  pendingPath: string | null
  lastEvent: NavigationEvent | null
}

const initialContext: NavigationMachineContext = {
  state: 'idle',
  currentEventId: null,
  activePath: null,
  pendingPath: null,
  lastEvent: null,
}

let context: NavigationMachineContext = initialContext
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function getNavigationMachineContext(): NavigationMachineContext {
  return context
}

export function subscribeNavigationMachine(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyNavigationEvent(event: NavigationEvent): NavigationMachineContext {
  const targetPath = event.path ?? null
  context = {
    state: 'observed',
    currentEventId: event.id,
    activePath: context.activePath,
    pendingPath: targetPath,
    lastEvent: event,
  }
  console.log('[NAV STATE] transition', context)
  notify()
  return context
}

export function resetNavigationMachine(): void {
  context = initialContext
  notify()
}
