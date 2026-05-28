import type { InteractionEffect } from './interactionKernelReducer'
import type { InteractionKernelState } from './interactionKernelState'
import type { InteractionIntent, InteractionPlan } from './types'

/** Logical time (monotonically increasing, not wall-clock).*/
export type LogicalEpoch = number

export type InteractionEventKind =
  | 'plan_start'
  | 'reduce_complete'
  | 'host_effect'
  | 'scheduled_effect'
  | 'commit'
  | 'frame_complete'

export type InteractionEvent = {
  kind: InteractionEventKind
  logicalEpoch: LogicalEpoch
  traceId: string
  payload?: Record<string, unknown>
}

export type TraceScheduledEffect =
  | { kind: 'scheduleFocus'; schedulerEpoch: number }
  | { kind: 'scheduleScroll'; schedulerEpoch: number }
  | { kind: 'cancelScheduler'; schedulerEpoch: number }
  | { kind: 'armHoverTimer'; schedulerEpoch: number; hoverEpoch: number; key: string; delayMs: number }
  | { kind: 'cancelHoverTimer'; schedulerEpoch: number }

export type TraceHostEffectRecord = {
  effect: InteractionEffect
  ok: boolean
}

export type CommitTraceBinding = {
  traceId: string
  osRevision: number
}

export type InteractionTraceFrame = {
  traceId: string
  logicalEpoch: LogicalEpoch
  intents: InteractionIntent[]
  plan: InteractionPlan
  inputState: InteractionKernelState
  outputState: InteractionKernelState
  inputStateHash: string
  outputStateHash: string
  reducerEffects: InteractionEffect[]
  hostEffects: TraceHostEffectRecord[]
  scheduledEffects: TraceScheduledEffect[]
  commit: boolean
  focus: boolean
  commitBinding: CommitTraceBinding | null
  events: InteractionEvent[]
}

export type InteractionTrace = {
  frames: InteractionTraceFrame[]
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return v
  })
}

export function hashInteractionState(state: InteractionKernelState): string {
  const s = stableSerialize(state)
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  return `ih-${(h >>> 0).toString(16)}`
}

export function cloneInteractionState(state: InteractionKernelState): InteractionKernelState {
  if (!import.meta.env.DEV) {
    return state
  }
  return JSON.parse(stableSerialize(state)) as InteractionKernelState
}

export function createEmptyInteractionTrace(): InteractionTrace {
  return { frames: [] }
}
