import { flushPendingNodeActivationQueue } from './graphNodeActivationRuntime'

/**
 * Graph readiness barrier — flush navigation pending center is allowed only after topology + layout is ready.
 */

export type GraphReadinessState = 'UNINITIALIZED' | 'NAVIGATING' | 'READY'

let graphReadinessState: GraphReadinessState = 'UNINITIALIZED'
let topologyReady = false
let layoutReady = false

const readinessListeners = new Set<() => void>()

function notifyReadinessListeners(): void {
  for (const fn of readinessListeners) {
    fn()
  }
}

function tryEnterReady(): void {
  if (!topologyReady || !layoutReady) return
  if (graphReadinessState === 'READY') {
    flushPendingNodeActivationQueue()
    notifyReadinessListeners()
    return
  }
  graphReadinessState = 'READY'
  flushPendingNodeActivationQueue()
  notifyReadinessListeners()
}

export function getGraphReadinessState(): GraphReadinessState {
  return graphReadinessState
}

export function isGraphTopologyReady(): boolean {
  return topologyReady
}

export function isGraphLayoutReady(): boolean {
  return layoutReady
}

export function isGraphReady(): boolean {
  return graphReadinessState === 'READY' && topologyReady && layoutReady
}

/** When backlink/navigation carries pending center, it enters NAVIGATING and waits for double signals.*/
export function beginGraphNavigationReadiness(): void {
  graphReadinessState = 'NAVIGATING'
  topologyReady = false
  layoutReady = false
}

export function notifyGraphTopologyReady(): void {
  topologyReady = true
  if (graphReadinessState === 'UNINITIALIZED') {
    graphReadinessState = 'NAVIGATING'
  }
  flushPendingNodeActivationQueue()
  tryEnterReady()
}

export function notifyGraphLayoutReady(): void {
  layoutReady = true
  tryEnterReady()
}

export function notifyGraphLayoutUnavailable(): void {
  layoutReady = false
  if (graphReadinessState === 'READY') {
    graphReadinessState = 'NAVIGATING'
  }
}

export function subscribeGraphReadiness(listener: () => void): () => void {
  readinessListeners.add(listener)
  return () => readinessListeners.delete(listener)
}

export function resetGraphReadinessRuntime(): void {
  graphReadinessState = 'UNINITIALIZED'
  topologyReady = false
  layoutReady = false
  readinessListeners.clear()
}
