import type { InteractionEffect } from './interactionKernelReducer'
import type { InteractionKernelState } from './interactionKernelState'
import type { InteractionPlan } from './types'
import type { CommitTraceBinding } from './interactionCommit'
import { completeInteractionCommitTick } from '../../osKernelClock'
import { onInteractionTraceFrameCommitted, resetInteractionTimeAxis } from './interactionTimeAxis'
import {
  cloneInteractionState,
  createEmptyInteractionTrace,
  hashInteractionState,
  type InteractionEvent,
  type InteractionTrace,
  type InteractionTraceFrame,
  type TraceScheduledEffect,
} from './interactionTraceModel'

const MAX_TRACE_FRAMES = 128

let logicalEpoch = 0
let traceLog: InteractionTrace = createEmptyInteractionTrace()
let draft: InteractionTraceFrame | null = null

function trimTraceFrames(): void {
  const overflow = traceLog.frames.length - MAX_TRACE_FRAMES
  if (overflow > 0) {
    traceLog.frames.splice(0, overflow)
  }
}

function pushEvent(event: InteractionEvent): void {
  if (!draft) return
  draft.events.push(event)
}

export function resetInteractionTraceLog(): void {
  logicalEpoch = 0
  traceLog = createEmptyInteractionTrace()
  draft = null
  resetInteractionTimeAxis()
}

export function getLastTraceFrame(): InteractionTraceFrame | null {
  if (traceLog.frames.length === 0) return null
  return traceLog.frames[traceLog.frames.length - 1]!
}

export function getInteractionTraceLog(): Readonly<InteractionTrace> {
  return traceLog
}

export function getInteractionTraceFrame(traceId: string): InteractionTraceFrame | undefined {
  return traceLog.frames.find((f) => f.traceId === traceId)
}

/** KernelExecutor outer layer: record input state before plan execution starts.*/
export function beginInteractionTraceFrame(
  plan: InteractionPlan,
  inputState: InteractionKernelState,
): string {
  logicalEpoch += 1
  const traceId = `iktl-${logicalEpoch}`
  const input = cloneInteractionState(inputState)

  draft = {
    traceId,
    logicalEpoch,
    intents: [...plan.intents],
    plan: {
      intents: [...plan.intents],
      steps: plan.steps.map((s) => ({ kind: s.kind, intent: { ...s.intent } })),
    },
    inputState: input,
    outputState: input,
    inputStateHash: hashInteractionState(input),
    outputStateHash: hashInteractionState(input),
    reducerEffects: [],
    hostEffects: [],
    scheduledEffects: [],
    commit: false,
    focus: false,
    commitBinding: null,
    events: [],
  }

  pushEvent({
    kind: 'plan_start',
    logicalEpoch,
    traceId,
    payload: { stepKinds: plan.steps.map((s) => s.kind) },
  })

  return traceId
}

export function recordReducerTrace(
  outputState: InteractionKernelState,
  reducerEffects: InteractionEffect[],
  commit: boolean,
  focus: boolean,
): void {
  if (!draft) return
  const out = cloneInteractionState(outputState)
  draft.outputState = out
  draft.outputStateHash = hashInteractionState(out)
  draft.reducerEffects = reducerEffects.map((e) => ({ ...e })) as InteractionEffect[]
  draft.commit = commit
  draft.focus = focus

  pushEvent({
    kind: 'reduce_complete',
    logicalEpoch: draft.logicalEpoch,
    traceId: draft.traceId,
    payload: {
      outputStateHash: draft.outputStateHash,
      effectCount: reducerEffects.length,
      commit,
      focus,
    },
  })
}

export function recordHostEffectTrace(effect: InteractionEffect, ok: boolean): void {
  if (!draft) return
  draft.hostEffects.push({ effect: { ...effect } as InteractionEffect, ok })
  pushEvent({
    kind: 'host_effect',
    logicalEpoch: draft.logicalEpoch,
    traceId: draft.traceId,
    payload: { effectType: effect.type, ok },
  })
}

export function recordScheduledEffectTrace(effect: TraceScheduledEffect): void {
  if (!draft) return
  draft.scheduledEffects.push({ ...effect })
  pushEvent({
    kind: 'scheduled_effect',
    logicalEpoch: draft.logicalEpoch,
    traceId: draft.traceId,
    payload: { scheduledKind: effect.kind },
  })
}

export function finalizeInteractionTraceFrame(
  commitBinding: CommitTraceBinding | null,
): InteractionTraceFrame | null {
  if (!draft) return null

  draft.commitBinding = commitBinding
  if (commitBinding) {
    pushEvent({
      kind: 'commit',
      logicalEpoch: draft.logicalEpoch,
      traceId: draft.traceId,
      payload: { osRevision: commitBinding.osRevision },
    })
  }

  pushEvent({
    kind: 'frame_complete',
    logicalEpoch: draft.logicalEpoch,
    traceId: draft.traceId,
  })

  const frame = draft
  traceLog.frames.push(frame)
  trimTraceFrames()
  const frameIndex = traceLog.frames.length - 1
  draft = null
  if (frame.commitBinding) {
    completeInteractionCommitTick(frame.traceId, frameIndex)
  }
  onInteractionTraceFrameCommitted(frame)
  return frame
}

export function getCurrentLogicalEpoch(): number {
  return logicalEpoch
}
