import type { InteractionIntent, InteractionPlan, InteractionStepKind } from './types'
import { INTERACTION_STEP_ORDER, dedupeInteractionSteps } from './planner'

const NAV_BLOCKING_KINDS = new Set<InteractionStepKind>([
  'navigate',
  'closeOverlay',
  'openSearchModal',
])

const HOVER_KINDS = new Set<InteractionStepKind>(['scheduleHover'])

function intentPriority(intent: InteractionIntent): number {
  switch (intent.type) {
    case 'navigate':
    case 'workspace_restore':
      return 100
    case 'search':
      return 80
    case 'hover_end':
      return 70
    case 'hover':
      return 10
    case 'focus':
      return 50
    case 'selection':
      return 40
    default:
      return 0
  }
}

export function collapseInteractionIntents(intents: InteractionIntent[]): InteractionIntent[] {
  if (intents.length <= 1) return intents
  const maxPriority = Math.max(...intents.map(intentPriority))
  if (maxPriority >= 100) {
    return intents.filter((i) => intentPriority(i) >= 10 || i.type === 'hover_end')
  }
  if (maxPriority >= 80) {
    return intents.filter((i) => i.type !== 'hover')
  }
  return intents
}

function normalizeMergedPlan(plan: InteractionPlan): InteractionPlan {
  const intents = collapseInteractionIntents(plan.intents)
  let steps = dedupeInteractionSteps(plan.steps)

  const hasNavigate = steps.some((s) => s.kind === 'navigate')
  if (hasNavigate) {
    steps = steps.filter((s) => !HOVER_KINDS.has(s.kind))
    if (!steps.some((s) => s.kind === 'cancelHover')) {
      const nav = steps.find((s) => s.kind === 'navigate')
      if (nav) {
        steps = [{ kind: 'cancelHover', intent: nav.intent }, ...steps]
      }
    }
  }

  steps = INTERACTION_STEP_ORDER.flatMap((kind) => {
    const hit = steps.find((s) => s.kind === kind)
    return hit ? [hit] : []
  })

  return { intents, steps }
}

export function mergeInteractionPlans(
  current: InteractionPlan | null,
  incoming: InteractionPlan,
): InteractionPlan {
  if (!current) return normalizeMergedPlan(incoming)

  const hasNav =
    current.steps.some((s) => NAV_BLOCKING_KINDS.has(s.kind)) ||
    incoming.steps.some((s) => NAV_BLOCKING_KINDS.has(s.kind))

  let steps = [...current.steps, ...incoming.steps]
  if (hasNav) {
    steps = steps.filter((s) => !HOVER_KINDS.has(s.kind))
  }

  return normalizeMergedPlan({
    intents: collapseInteractionIntents([...current.intents, ...incoming.intents]),
    steps,
  })
}

export function coalesceInteractionPlanQueue(queue: InteractionPlan[]): InteractionPlan {
  let merged: InteractionPlan | null = null
  for (const p of queue) {
    merged = mergeInteractionPlans(merged, p)
  }
  return merged ?? { intents: [], steps: [] }
}
