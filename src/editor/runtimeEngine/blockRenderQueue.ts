import type { RenderPriority } from './renderPriority'
import { compareRenderPriority } from './renderPriority'
import { recordCancelledRender, recordQueueDepth } from './runtimeMetrics'

export type BlockRenderTask = {
  blockId: string
  priority: RenderPriority
  generation: number
  label: string
  run: (signal: AbortSignal) => Promise<void>
}

const queue: BlockRenderTask[] = []
const generationByBlock = new Map<string, number>()
const abortByBlock = new Map<string, AbortController>()

let drainScheduled = false
let running = false
let runningTask: BlockRenderTask | null = null

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

function sortQueue(): void {
  queue.sort((a, b) => {
    const p = compareRenderPriority(a.priority, b.priority)
    if (p !== 0) return p
    return b.generation - a.generation
  })
}

function scheduleDrain(): void {
  if (drainScheduled) return
  drainScheduled = true
  queueMicrotask(() => {
    drainScheduled = false
    void drainQueue()
  })
}

async function drainQueue(): Promise<void> {
  if (running) return
  running = true
  try {
    while (queue.length > 0) {
      const task = queue.shift()!
      recordQueueDepth(queue.length)

      const currentGen = generationByBlock.get(task.blockId)
      if (currentGen !== task.generation) {
        recordCancelledRender()
        continue
      }

      const prev = abortByBlock.get(task.blockId)
      prev?.abort()
      const ac = new AbortController()
      abortByBlock.set(task.blockId, ac)
      runningTask = task

      try {
        await task.run(ac.signal)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          // swallow — caller handles UI error state
        } else {
          recordCancelledRender()
        }
      } finally {
        if (runningTask === task) runningTask = null
        if (abortByBlock.get(task.blockId) === ac) {
          abortByBlock.delete(task.blockId)
        }
      }

      recordQueueDepth(queue.length)
      if (queue.length > 0) await yieldToBrowser()
    }
  } finally {
    runningTask = null
    running = false
    if (queue.length > 0) scheduleDrain()
  }
}

export function enqueueBlockRenderTask(task: BlockRenderTask): void {
  const existingIdx = queue.findIndex((t) => t.blockId === task.blockId)
  if (existingIdx >= 0) {
    const existing = queue[existingIdx]!
    if (compareRenderPriority(task.priority, existing.priority) <= 0) {
      queue.splice(existingIdx, 1)
    } else {
      recordCancelledRender()
      return
    }
  }

  queue.push(task)
  sortQueue()
  recordQueueDepth(queue.length)
  scheduleDrain()
}

export function bumpBlockRenderGeneration(blockId: string): number {
  const next = (generationByBlock.get(blockId) ?? 0) + 1
  generationByBlock.set(blockId, next)
  return next
}

export function getBlockRenderGeneration(blockId: string): number {
  return generationByBlock.get(blockId) ?? 0
}

export function cancelBlockRenderTask(blockId: string): void {
  bumpBlockRenderGeneration(blockId)
  const ac = abortByBlock.get(blockId)
  ac?.abort()
  abortByBlock.delete(blockId)
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]!.blockId === blockId) queue.splice(i, 1)
  }
  recordQueueDepth(queue.length)
  recordCancelledRender()
}

export function flushBlockRenderQueue(): void {
  queue.length = 0
  for (const ac of abortByBlock.values()) ac.abort()
  abortByBlock.clear()
  recordQueueDepth(0)
}

export function preemptLowerPriorityBlockRenderTasks(minPriority: RenderPriority): void {
  if (runningTask && compareRenderPriority(runningTask.priority, minPriority) > 0) {
    abortByBlock.get(runningTask.blockId)?.abort()
  }
  for (const task of [...queue]) {
    if (compareRenderPriority(task.priority, minPriority) > 0) {
      cancelBlockRenderTask(task.blockId)
    }
  }
}

export function getBlockRenderQueueDepth(): number {
  return queue.length
}
