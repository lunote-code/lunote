import {
  bumpBlockRenderGeneration,
  cancelBlockRenderTask,
  enqueueBlockRenderTask,
  flushBlockRenderQueue,
  getBlockRenderGeneration,
  getBlockRenderQueueDepth,
  preemptLowerPriorityBlockRenderTasks,
} from './blockRenderQueue'
import type { RenderPriority } from './renderPriority'
import { maxRenderPriority } from './renderPriority'
import { recordRenderCost, recordTransactionDuration } from './runtimeMetrics'
import { isBlockVirtualized, shouldRenderBlockPreview } from './virtualBlockViewport'
import { cancelEveryAsyncBlockRender } from './unified/asyncBlockWorker'

const priorityByBlock = new Map<string, RenderPriority>()

export function scheduleBlockRender(
  blockId: string,
  priority: RenderPriority,
  run: (signal: AbortSignal) => Promise<void>,
  label = 'block-render',
): number {
  if (!blockId) return 0

  const prev = priorityByBlock.get(blockId)
  const merged = prev ? maxRenderPriority(prev, priority) : priority
  priorityByBlock.set(blockId, merged)

  if (isBlockVirtualized(blockId) && merged !== 'interaction' && merged !== 'visible') {
    return getBlockRenderGeneration(blockId)
  }

  if (!shouldRenderBlockPreview(blockId) && merged !== 'interaction') {
    return getBlockRenderGeneration(blockId)
  }

  const generation = bumpBlockRenderGeneration(blockId)

  enqueueBlockRenderTask({
    blockId,
    priority: merged,
    generation,
    label,
    run: async (signal) => {
      const t0 = performance.now()
      try {
        await run(signal)
      } finally {
        recordRenderCost(performance.now() - t0)
      }
    },
  })

  return generation
}

export function cancelBlockRender(blockId: string): void {
  cancelBlockRenderTask(blockId)
  priorityByBlock.delete(blockId)
}

export function flushRenderQueue(): void {
  flushBlockRenderQueue()
  priorityByBlock.clear()
}

/** Drop queued preview work below `minPriority` so user interactions are not starved. */
export function preemptLowerPriorityBlockRenders(minPriority: RenderPriority): void {
  preemptLowerPriorityBlockRenderTasks(minPriority)
}

/** Abort queued and in-flight diagram preview work so UI interactions (e.g. Source tab) are not starved. */
export function pauseAllBlockPreviewRenders(): void {
  flushBlockRenderQueue()
  priorityByBlock.clear()
  cancelEveryAsyncBlockRender()
}

export function getScheduledRenderPriority(blockId: string): RenderPriority | undefined {
  return priorityByBlock.get(blockId)
}

export function runScheduledTransaction<T>(_label: string, fn: () => T): T {
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    recordTransactionDuration(performance.now() - t0)
  }
}

export { getBlockRenderGeneration, getBlockRenderQueueDepth }
