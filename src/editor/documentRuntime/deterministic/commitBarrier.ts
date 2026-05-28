import type { RuntimePhase } from './runtimePhase'
import { compareRuntimePhase, isPhaseBefore } from './runtimePhase'

const DOCUMENT_SCOPE = 'document'

/** Per-scope highest completed phase */
const completedPhase = new Map<string, RuntimePhase>()

function scopeKey(blockId?: string | null): string {
  return blockId ? `block:${blockId}` : DOCUMENT_SCOPE
}

function requiredUpstream(target: RuntimePhase): RuntimePhase | null {
  switch (target) {
    case 'layout':
      return null
    case 'render':
      return 'layout'
    case 'viewport':
      return 'render'
    case 'commit':
      return 'viewport'
    default:
      return null
  }
}

export function markBarrierComplete(scope: string, phase: RuntimePhase): void {
  const prev = completedPhase.get(scope)
  if (!prev || compareRuntimePhase(phase, prev) > 0) {
    completedPhase.set(scope, phase)
  }
}

export function getBarrierPhase(scope: string): RuntimePhase | null {
  return completedPhase.get(scope) ?? null
}

function scopeSatisfiesUpstream(scope: string, upstream: RuntimePhase): boolean {
  const done = completedPhase.get(scope)
  if (!done) return false
  return !isPhaseBefore(done, upstream)
}

/**
 * Render commit requires layout; viewport requires render; selection/layout always allowed.
 */
export function canPassCommitBarrier(
  targetPhase: RuntimePhase,
  blockId?: string | null,
): boolean {
  if (targetPhase === 'input' || targetPhase === 'selection' || targetPhase === 'idle') {
    return true
  }

  const upstream = requiredUpstream(targetPhase)
  if (!upstream) return true

  const scope = scopeKey(blockId)
  if (scopeSatisfiesUpstream(scope, upstream)) return true
  if (scope !== DOCUMENT_SCOPE && scopeSatisfiesUpstream(DOCUMENT_SCOPE, upstream)) return true

  return false
}

export function clearCommitBarriers(scope?: string): void {
  if (!scope) {
    completedPhase.clear()
    return
  }
  completedPhase.delete(scope)
}
