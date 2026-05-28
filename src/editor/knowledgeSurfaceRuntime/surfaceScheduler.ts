import type { SurfacePriority } from './types'

export type SurfaceTaskKind =
  | 'hover'
  | 'graph'
  | 'search'
  | 'overlay'
  | 'preview'
  | 'sidebar'
  | 'palette'

export type SurfaceTask = {
  key: string
  kind: SurfaceTaskKind
  priority: SurfacePriority
  run: () => void | Promise<void>
  generation?: number
}

const ORDER: Record<SurfacePriority, number> = {
  critical: 0,
  interaction: 1,
  background: 2,
  idle: 3,
}

const queue: SurfaceTask[] = []
const seen = new Set<string>()
let draining = false
let generation = 0
const starvationCounter = new Map<SurfacePriority, number>()

export function bumpSurfaceGeneration(): number {
  generation += 1
  return generation
}

export function scheduleSurfaceTask(task: SurfaceTask): void {
  const idx = queue.findIndex((t) => t.key === task.key)
  if (idx >= 0) {
    queue.splice(idx, 1)
    seen.delete(task.key)
  }
  queue.push(task)
  seen.add(task.key)
  queue.sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
  scheduleDrain()
}

export function cancelSurfaceTasksByPrefix(prefix: string): void {
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
  const run = () => {
    draining = false
    void drainSurfaceQueue()
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 24 })
  } else {
    queueMicrotask(run)
  }
}

export async function drainSurfaceQueue(): Promise<void> {
  const batch = queue.splice(0, Math.min(queue.length, 6))
  for (const task of batch) {
    seen.delete(task.key)
    if (task.generation != null && task.generation !== generation) continue
    const count = (starvationCounter.get(task.priority) ?? 0) + 1
    starvationCounter.set(task.priority, count)
    try {
      await task.run()
    } catch {
      /* task */
    }
  }
  if (queue.length > 0) scheduleDrain()
}

export function resetSurfaceScheduler(): void {
  queue.length = 0
  seen.clear()
  draining = false
  generation = 0
  starvationCounter.clear()
}
