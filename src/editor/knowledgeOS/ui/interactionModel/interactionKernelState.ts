import type { WikiLinkTarget } from '../../../knowledgeRuntime/types'
import type { InteractionIntent } from './types'

export type HoverPending = {
  target: WikiLinkTarget
  pointer: { x: number; y: number }
  key: string
  epoch: number
}

export type HoverState = {
  epoch: number
  pending: HoverPending | null
  activeKey: string | null
}

export type SelectionState = {
  cleared: boolean
}

export type NavigationState = {
  active: boolean
  intent: InteractionIntent | null
}

export type InteractionKernelState = {
  hover: HoverState
  selection: SelectionState
  navigation: NavigationState
  /** Disabled unified generation of effect tail / hover timer (non-generation guard system).*/
  epoch: number
}

export function createInitialInteractionKernelState(): InteractionKernelState {
  return {
    hover: { epoch: 0, pending: null, activeKey: null },
    selection: { cleared: false },
    navigation: { active: false, intent: null },
    epoch: 0,
  }
}

export function hoverTargetKey(t: WikiLinkTarget): string {
  return `${t.docKey}|${t.heading ?? ''}|${t.blockId ?? ''}`
}

export function cancelHoverState(hover: HoverState): HoverState {
  return {
    epoch: hover.epoch + 1,
    pending: null,
    activeKey: null,
  }
}
