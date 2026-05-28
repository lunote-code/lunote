import type { InteractionIntent } from './types'
import type { InteractionPlan, InteractionStep } from './types'
import {
  cancelHoverState,
  createInitialInteractionKernelState,
  hoverTargetKey,
  type InteractionKernelState,
} from './interactionKernelState'

export type InteractionEffect =
  | { type: 'hideHover' }
  | { type: 'armHover'; intent: InteractionIntent; epoch: number; key: string }
  | { type: 'clearSelection' }
  | { type: 'navigate'; intent: InteractionIntent }
  | { type: 'openSearchModal' }
  | { type: 'closeOverlay' }

export type InteractionReduceResult = {
  state: InteractionKernelState
  effects: InteractionEffect[]
  commit: boolean
  focus: boolean
}

function applyStep(
  state: InteractionKernelState,
  step: InteractionStep,
): { state: InteractionKernelState; effects: InteractionEffect[]; commit: boolean; focus: boolean } {
  const effects: InteractionEffect[] = []
  let commit = false
  let focus = false
  let next = state

  switch (step.kind) {
    case 'cancelHover': {
      next = { ...next, hover: cancelHoverState(next.hover), epoch: next.epoch + 1 }
      effects.push({ type: 'hideHover' })
      break
    }

    case 'clearSelection': {
      next = { ...next, selection: { cleared: true } }
      effects.push({ type: 'clearSelection' })
      break
    }

    case 'closeOverlay': {
      effects.push({ type: 'closeOverlay' })
      break
    }

    case 'navigate': {
      next = {
        ...next,
        epoch: next.epoch + 1,
        navigation: { active: true, intent: step.intent },
      }
      effects.push({ type: 'navigate', intent: step.intent })
      break
    }

    case 'scheduleHover': {
      if (next.navigation.active) break
      const target = step.intent.target
      const pointer = step.intent.pointer
      if (!target || !pointer) break
      const key = hoverTargetKey(target)
      if (next.hover.pending?.key === key && next.hover.activeKey === key) break
      const epoch = next.hover.epoch
      next = {
        ...next,
        hover: {
          ...next.hover,
          pending: { target, pointer, key, epoch },
        },
      }
      effects.push({ type: 'armHover', intent: step.intent, epoch, key })
      break
    }

    case 'openSearchModal': {
      next = { ...next, hover: cancelHoverState(next.hover), epoch: next.epoch + 1 }
      effects.push({ type: 'hideHover' })
      effects.push({ type: 'openSearchModal' })
      break
    }

    case 'updateSnapshot':
      commit = true
      break

    case 'emitBacklinkUpdate':
    case 'emitGraphUpdate':
    case 'emitSearchUpdate':
      break

    case 'focusEditor':
      focus = true
      break

    default:
      break
  }

  return { state: next, effects, commit, focus }
}

/**
 * Pure function: plan + prevState → nextState + ordered effects + commit/focus flag.
 */
export function reduceInteractionPlan(
  prev: InteractionKernelState,
  plan: InteractionPlan,
): InteractionReduceResult {
  let state = prev
  const effects: InteractionEffect[] = []
  let commit = false
  let focus = false

  for (const step of plan.steps) {
    const applied = applyStep(state, step)
    state = applied.state
    effects.push(...applied.effects)
    commit = commit || applied.commit
    focus = focus || applied.focus
  }

  if (commit) {
    state = {
      ...state,
      navigation: { active: false, intent: null },
      hover: cancelHoverState(state.hover),
      selection: { cleared: false },
    }
  }

  return { state, effects, commit, focus }
}

export { createInitialInteractionKernelState }
