import type {
  InteractionIntent,
  InteractionPlan,
  InteractionStep,
  InteractionStepKind,
} from './types'

/** Global deterministic step sequence (rule-driven, not hard-coded at the call site).*/
export const INTERACTION_STEP_ORDER: readonly InteractionStepKind[] = [
  'cancelHover',
  'closeOverlay',
  'clearSelection',
  'navigate',
  'scheduleHover',
  'openSearchModal',
  'updateSnapshot',
  'emitBacklinkUpdate',
  'emitGraphUpdate',
  'emitSearchUpdate',
  'focusEditor',
] as const

const STEP_RANK = new Map<InteractionStepKind, number>(
  INTERACTION_STEP_ORDER.map((k, i) => [k, i]),
)

function step(intent: InteractionIntent, kind: InteractionStepKind): InteractionStep {
  return { kind, intent }
}

function stepsForIntent(intent: InteractionIntent): InteractionStep[] {
  const mods = intent.modifiers ?? {}

  switch (intent.type) {
    case 'navigate':
    case 'workspace_restore':
      return [
        ...(mods.suppressHover ? [] : [step(intent, 'cancelHover')]),
        ...(mods.preserveSelection ? [] : [step(intent, 'clearSelection')]),
        step(intent, 'navigate'),
        step(intent, 'updateSnapshot'),
        step(intent, 'emitBacklinkUpdate'),
        step(intent, 'emitGraphUpdate'),
        step(intent, 'emitSearchUpdate'),
        step(intent, 'focusEditor'),
      ]

    case 'hover':
      return mods.suppressHover ? [] : [step(intent, 'scheduleHover')]

    case 'hover_end':
      return [step(intent, 'cancelHover')]

    case 'search':
      return [
        ...(mods.suppressHover ? [] : [step(intent, 'cancelHover')]),
        step(intent, 'closeOverlay'),
        step(intent, 'openSearchModal'),
      ]

    case 'focus':
      return [step(intent, 'focusEditor')]

    case 'selection':
      return mods.preserveSelection ? [] : [step(intent, 'clearSelection')]

    default:
      return []
  }
}

/** Same as kind, keep the last one (navigate payload is based on the last one).*/
export function dedupeInteractionSteps(steps: InteractionStep[]): InteractionStep[] {
  const lastByKind = new Map<InteractionStepKind, InteractionStep>()
  for (const s of steps) {
    lastByKind.set(s.kind, s)
  }
  return INTERACTION_STEP_ORDER.flatMap((kind) => {
    const hit = lastByKind.get(kind)
    return hit ? [hit] : []
  })
}

/** navigate overrides hover; merged and sorted by INTERACTION_STEP_ORDER.*/
export function normalizeInteractionSteps(steps: InteractionStep[]): InteractionStep[] {
  const hasNavigate = steps.some((s) => s.kind === 'navigate')
  const suppressHoverSchedule = steps.some((s) => s.kind === 'closeOverlay')
  let next = steps

  if (hasNavigate || suppressHoverSchedule) {
    next = next.filter((s) => s.kind !== 'scheduleHover')
    if (!next.some((s) => s.kind === 'cancelHover')) {
      const nav = next.find((s) => s.kind === 'navigate')
      if (nav) next = [step(nav.intent, 'cancelHover'), ...next]
    }
  }

  return dedupeInteractionSteps(next)
}

export function buildInteractionPlan(intent: InteractionIntent): InteractionPlan {
  const steps = normalizeInteractionSteps(stepsForIntent(intent))
  return { intents: [intent], steps }
}

export function composeInteractions(intents: InteractionIntent[]): InteractionPlan {
  if (intents.length === 0) {
    return { intents: [], steps: [] }
  }
  if (intents.length === 1) {
    return buildInteractionPlan(intents[0]!)
  }

  const mergedModifiers: InteractionIntent['modifiers'] = {}
  for (const i of intents) {
    if (i.modifiers?.preserveSelection) mergedModifiers.preserveSelection = true
    if (i.modifiers?.suppressHover) mergedModifiers.suppressHover = true
  }

  const rawSteps = intents.flatMap((intent) =>
    stepsForIntent({
      ...intent,
      modifiers: { ...mergedModifiers, ...intent.modifiers },
    }),
  )

  const steps = normalizeInteractionSteps(rawSteps)
  return { intents, steps }
}

export function sortStepsByRuleOrder(steps: InteractionStep[]): InteractionStep[] {
  return [...steps].sort((a, b) => (STEP_RANK.get(a.kind) ?? 0) - (STEP_RANK.get(b.kind) ?? 0))
}
