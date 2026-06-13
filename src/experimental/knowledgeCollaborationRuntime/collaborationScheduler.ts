import type { DistributedRuntimePatch } from './types'

export type CollabPriority = 'critical' | 'interaction' | 'background' | 'idle'

export type CollabTask = {
  key: string
  priority: CollabPriority
  run: () => void | Promise<void>
}

const ORDER: Record<CollabPriority, number> = {
  critical: 0,
  interaction: 1,
  background: 2,
  idle: 3,
}

const queue: CollabTask[] = []
const seen = new Set<string>()
let draining = false

export function scheduleCollabTask(task: CollabTask): void {
  if (seen.has(task.key)) {
    const idx = queue.findIndex((t) => t.key === task.key)
    if (idx >= 0) queue.splice(idx, 1)
    seen.delete(task.key)
  }
  queue.push(task)
  seen.add(task.key)
  queue.sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
  scheduleDrain()
}

export function cancelCollabTasksByPrefix(prefix: string): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]!.key.startsWith(prefix)) {
      seen.delete(queue[i]!.key)
      queue.splice(i, 1)
    }
  }
}

function scheduleDrain(): void {
  if (draining) return
  draining = true
  queueMicrotask(() => {
    draining = false
    void drainCollabQueue()
  })
}

export async function drainCollabQueue(): Promise<void> {
  const batch = queue.splice(0, Math.min(queue.length, 12))
  for (const task of batch) {
    seen.delete(task.key)
    try {
      await task.run()
    } catch {
      /* task */
    }
  }
  if (queue.length > 0) scheduleDrain()
}

export function schedulePatchApply(
  patch: DistributedRuntimePatch,
  apply: (p: DistributedRuntimePatch) => void,
): void {
  scheduleCollabTask({
    key: `patch:${patch.patchId}`,
    priority: patch.kind === 'cursor' || patch.kind === 'selection' ? 'interaction' : 'background',
    run: () => apply(patch),
  })
}

export function resetCollaborationScheduler(): void {
  queue.length = 0
  seen.clear()
  draining = false
}
