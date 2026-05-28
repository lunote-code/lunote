/**
 * CBR v6.5 — deterministic runtime phase ordering.
 */
export type RuntimePhase =
  | 'input'
  | 'selection'
  | 'layout'
  | 'render'
  | 'viewport'
  | 'commit'
  | 'idle'

/** Lower index = earlier in the dependency graph */
export const RUNTIME_PHASE_ORDER: readonly RuntimePhase[] = [
  'input',
  'selection',
  'layout',
  'render',
  'viewport',
  'commit',
  'idle',
] as const

const phaseIndex = new Map<RuntimePhase, number>(
  RUNTIME_PHASE_ORDER.map((p, i) => [p, i]),
)

export function compareRuntimePhase(a: RuntimePhase, b: RuntimePhase): number {
  return (phaseIndex.get(a) ?? 0) - (phaseIndex.get(b) ?? 0)
}

export function isPhaseBefore(a: RuntimePhase, b: RuntimePhase): boolean {
  return compareRuntimePhase(a, b) < 0
}

export function phaseFromTaskKind(
  kind: 'render' | 'layout' | 'selection' | 'viewport' | 'async',
): RuntimePhase {
  switch (kind) {
    case 'selection':
      return 'selection'
    case 'layout':
      return 'layout'
    case 'viewport':
      return 'viewport'
    case 'async':
    case 'render':
      return 'render'
    default:
      return 'commit'
  }
}
