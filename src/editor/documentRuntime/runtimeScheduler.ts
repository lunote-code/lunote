import { bumpDocumentTick } from './documentClock'
import {
  canPassCommitBarrier,
  markBarrierComplete,
  nextRuntimeSequence,
  phaseFromTaskKind,
  runGuardedAsyncCommit,
  sortOrderedTasks,
  type RuntimePhase,
} from './deterministic'
import { shouldBypassRuntimeSchedulerTask } from './nativeInput'

export type RuntimeTaskKind = 'render' | 'layout' | 'selection' | 'viewport' | 'async'

export type RuntimeTask = {
  key: string
  kind: RuntimeTaskKind
  /** v6.5: required phase for deterministic ordering */
  phase?: RuntimePhase
  priority: number
  blockId?: string | null
  generation?: number
  run: () => void | Promise<void>
}

type QueuedTask = RuntimeTask & {
  phase: RuntimePhase
  sequence: number
}

const queue: QueuedTask[] = []
const seenKeys = new Set<string>()
let draining = false
let currentPhase: RuntimePhase = 'idle'

export function getRuntimeSchedulerPhase(): RuntimePhase {
  return currentPhase
}

function enqueue(task: RuntimeTask): void {
  const phase = task.phase ?? phaseFromTaskKind(task.kind)
  const idx = queue.findIndex((t) => t.key === task.key)
  if (idx >= 0) {
    if (task.priority >= queue[idx]!.priority) {
      seenKeys.delete(task.key)
      queue.splice(idx, 1)
    } else {
      return
    }
  }
  queue.push({
    ...task,
    phase,
    sequence: nextRuntimeSequence(),
  })
  seenKeys.add(task.key)
}

function scheduleDrain(): void {
  if (draining) return
  draining = true
  queueMicrotask(() => {
    draining = false
    void drainRuntimeTasks()
  })
}

export async function drainRuntimeTasks(): Promise<void> {
  while (queue.length > 0) {
    sortOrderedTasks(queue)
    const task = queue.shift()!
    seenKeys.delete(task.key)

    if (shouldBypassRuntimeSchedulerTask(task.blockId, task.kind)) {
      continue
    }

    if (!canPassCommitBarrier(task.phase, task.blockId)) {
      queue.push(task)
      const head = queue[0]
      if (head?.key === task.key) break
      continue
    }

    currentPhase = task.phase

    try {
      if (task.kind === 'async' || task.kind === 'render') {
        if (task.blockId != null && task.generation != null) {
          const ok = await runGuardedAsyncCommit({
            blockId: task.blockId,
            generation: task.generation,
            phase: 'render',
            run: task.run,
          })
          if (!ok) continue
        } else {
          await task.run()
        }
      } else {
        await task.run()
      }
    } catch {
      /*task self-processing*/
    }

    const scope = task.blockId ? `block:${task.blockId}` : 'document'
    markBarrierComplete(scope, task.phase)
    bumpDocumentTick(
      task.kind === 'async' ? 'render' : (task.kind as 'render' | 'layout' | 'selection' | 'viewport'),
    )
  }
  currentPhase = 'idle'
}

export function scheduleRuntimeTask(task: RuntimeTask): void {
  enqueue(task)
  scheduleDrain()
}

export function cancelRuntimeTask(key: string): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]!.key === key) queue.splice(i, 1)
  }
  seenKeys.delete(key)
}

export function flushRuntimeTasks(): void {
  queue.length = 0
  seenKeys.clear()
}

export function getRuntimeTaskQueueDepth(): number {
  return queue.length
}
