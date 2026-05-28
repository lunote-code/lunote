export type RuntimeMetricSnapshot = {
  renderCostMs: number
  rerenderCount: number
  queueDepth: number
  asyncLatencyMs: number
  transactionDurationMs: number
  cancelledRenders: number
}

const metrics: RuntimeMetricSnapshot = {
  renderCostMs: 0,
  rerenderCount: 0,
  queueDepth: 0,
  asyncLatencyMs: 0,
  transactionDurationMs: 0,
  cancelledRenders: 0,
}

const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeRuntimeMetrics(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRuntimeMetrics(): Readonly<RuntimeMetricSnapshot> {
  return metrics
}

export function recordRenderCost(ms: number): void {
  metrics.renderCostMs = ms
  metrics.rerenderCount += 1
  emit()
}

export function recordQueueDepth(depth: number): void {
  metrics.queueDepth = depth
  emit()
}

export function recordAsyncLatency(ms: number): void {
  metrics.asyncLatencyMs = ms
  emit()
}

export function recordTransactionDuration(ms: number): void {
  metrics.transactionDurationMs = ms
  emit()
}

export function recordCancelledRender(): void {
  metrics.cancelledRenders += 1
  emit()
}

export function resetRuntimeMetrics(): void {
  metrics.renderCostMs = 0
  metrics.rerenderCount = 0
  metrics.queueDepth = 0
  metrics.asyncLatencyMs = 0
  metrics.transactionDurationMs = 0
  metrics.cancelledRenders = 0
  emit()
}
