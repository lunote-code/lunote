import { getGraphViewport, type GraphViewport } from './graphViewportRuntime'

/**
 * Suppress auto bbox centering during Graph node focus to prevent the viewport from being pulled to the upper left corner/full graph fit by topology reconstruction.
 */

let nodeViewportFocusDepth = 0
let suppressAutoCenterUntilMs = 0

export function beginGraphNodeViewportFocus(): void {
  nodeViewportFocusDepth += 1
  suppressAutoCenterUntilMs = performance.now() + 4000
}

export function endGraphNodeViewportFocus(): void {
  nodeViewportFocusDepth = Math.max(0, nodeViewportFocusDepth - 1)
}

export function shouldSuppressAutoGraphViewportCenter(): boolean {
  return nodeViewportFocusDepth > 0 || performance.now() < suppressAutoCenterUntilMs
}

export function preserveViewportBasis(): GraphViewport {
  return { ...getGraphViewport() }
}

export function resetGraphViewportFocusRuntime(): void {
  nodeViewportFocusDepth = 0
  suppressAutoCenterUntilMs = 0
}
