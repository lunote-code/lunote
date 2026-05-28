import type { InteractionPriority } from './types'

export type InteractionTaskKind =
  | 'hover'
  | 'preview'
  | 'semantic-search'
  | 'graph-layout'
  | 'suggestion'
  | 'backlink-group'
  | 'mention-scan'

export type InteractionTask = {
  key: string
  kind: InteractionTaskKind
  priority: InteractionPriority
  run: () => void | Promise<void>
  generation?: number
}

const PRIORITY_ORDER: Record<InteractionPriority, number> = {
  critical: 0,
  visible: 1,
  background: 2,
  idle: 3,
}

const queue: InteractionTask[] = []
const seenKeys = new Set<string>()
let draining = false
let globalGeneration = 0

export function bumpInteractionGeneration(): number {
  globalGeneration += 1
  return globalGeneration
}

export function getInteractionGeneration(): number {
  return globalGeneration
}

export function scheduleInteractionTask(task: InteractionTask): void {
  const existing = queue.findIndex((t) => t.key === task.key)
  if (existing >= 0) {
    const prev = queue[existing]!
    if (PRIORITY_ORDER[task.priority] >= PRIORITY_ORDER[prev.priority]) {
      queue.splice(existing, 1)
      seenKeys.delete(task.key)
    } else {
      return
    }
  }
  queue.push(task)
  seenKeys.add(task.key)
  sortQueue()
  scheduleDrain()
}

export function cancelInteractionTasksByPrefix(prefix: string): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]!.key.startsWith(prefix)) {
      seenKeys.delete(queue[i]!.key)
      queue.splice(i, 1)
    }
  }
}

function sortQueue(): void {
  queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

function scheduleDrain(): void {
  if (draining) return
  draining = true
  const run = () => {
    draining = false
    void drainInteractionQueue()
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 32 })
  } else {
    queueMicrotask(run)
  }
}

export async function drainInteractionQueue(): Promise<void> {
  const batch = queue.splice(0, Math.min(queue.length, 8))
  for (const task of batch) {
    seenKeys.delete(task.key)
    if (task.generation != null && task.generation !== globalGeneration) continue
    try {
      await task.run()
    } catch {
      /* task */
    }
  }
  if (queue.length > 0) scheduleDrain()
}

export function resetInteractionScheduler(): void {
  queue.length = 0
  seenKeys.clear()
  draining = false
  globalGeneration = 0
}
