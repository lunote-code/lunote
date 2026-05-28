import { getIsGraphUpdating } from './graphInteractionGuard'

/** layout/font/edge task count — must be 0 before renderStable.*/
let pendingLayoutTasks = 0
let fontReflowQueued = false
let edgeRecomputeScheduled = false
let lazyLayoutPending = false

export function setGraphLazyLayoutPending(pending: boolean): void {
  lazyLayoutPending = pending
}

export function beginGraphLayoutTask(): void {
  pendingLayoutTasks += 1
}

export function endGraphLayoutTask(): void {
  pendingLayoutTasks = Math.max(0, pendingLayoutTasks - 1)
}

export function markGraphFontReflowQueued(): void {
  fontReflowQueued = true
}

export function clearGraphFontReflowQueued(): void {
  fontReflowQueued = false
}

export function markGraphEdgeRecomputeScheduled(): void {
  edgeRecomputeScheduled = true
}

export function clearGraphEdgeRecomputeScheduled(): void {
  edgeRecomputeScheduled = false
}

export function hasPendingGraphLayoutJobs(): boolean {
  return (
    pendingLayoutTasks > 0 ||
    lazyLayoutPending ||
    fontReflowQueued ||
    edgeRecomputeScheduled ||
    getIsGraphUpdating()
  )
}

export function isGraphLayoutQuiescent(): boolean {
  return !hasPendingGraphLayoutJobs()
}

export function resetGraphLayoutDependencyRuntime(): void {
  pendingLayoutTasks = 0
  fontReflowQueued = false
  edgeRecomputeScheduled = false
  lazyLayoutPending = false
}
