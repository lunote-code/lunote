import type { RuntimePhase } from './runtimePhase'
import { compareRuntimePhase } from './runtimePhase'

export type OrderedRuntimeTask = {
  key: string
  phase: RuntimePhase
  priority: number
  sequence: number
  blockId?: string | null
}

let globalSequence = 0

export function nextRuntimeSequence(): number {
  return ++globalSequence
}

export function resetRuntimeOrdering(): void {
  globalSequence = 0
}

/**
 * Deterministic ordering: phase → priority → sequence → key
 */
export function compareOrderedTasks(a: OrderedRuntimeTask, b: OrderedRuntimeTask): number {
  const phaseCmp = compareRuntimePhase(a.phase, b.phase)
  if (phaseCmp !== 0) return phaseCmp
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.sequence !== b.sequence) return a.sequence - b.sequence
  return a.key.localeCompare(b.key)
}

export function sortOrderedTasks<T extends OrderedRuntimeTask>(tasks: T[]): T[] {
  tasks.sort(compareOrderedTasks)
  return tasks
}
