import type { RuntimePhase } from './runtimePhase'
import { RUNTIME_PHASE_ORDER } from './runtimePhase'

/** Runtime dependency graph: selection → layout → render → viewport → commit */
export const RUNTIME_DEPENDENCY_EDGES: ReadonlyArray<readonly [RuntimePhase, RuntimePhase]> = [
  ['input', 'selection'],
  ['selection', 'layout'],
  ['layout', 'render'],
  ['render', 'viewport'],
  ['viewport', 'commit'],
  ['commit', 'idle'],
] as const

const successors = new Map<RuntimePhase, RuntimePhase[]>()

for (const [from, to] of RUNTIME_DEPENDENCY_EDGES) {
  const list = successors.get(from) ?? []
  list.push(to)
  successors.set(from, list)
}

export function getPhaseSuccessors(phase: RuntimePhase): RuntimePhase[] {
  return successors.get(phase) ?? []
}

export function getRuntimeGraphPhases(): readonly RuntimePhase[] {
  return RUNTIME_PHASE_ORDER
}

export function requiresUpstreamPhase(
  target: RuntimePhase,
  upstream: RuntimePhase,
): boolean {
  const ti = RUNTIME_PHASE_ORDER.indexOf(target)
  const ui = RUNTIME_PHASE_ORDER.indexOf(upstream)
  return ui >= 0 && ti >= 0 && ui < ti
}
