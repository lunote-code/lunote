import { reduceInteractionPlan } from './interactionKernelReducer'
import {
  hashInteractionState,
  type InteractionTrace,
  type InteractionTraceFrame,
} from './interactionTraceModel'

export type ReplayFrameResult = {
  traceId: string
  ok: boolean
  stateHashMatch: boolean
  effectsMatch: boolean
  commitFlagMatch: boolean
  focusFlagMatch: boolean
  expectedOutputHash: string
  replayOutputHash: string
}

export type ReplayTraceResult = {
  ok: boolean
  frames: ReplayFrameResult[]
}

function effectsEqual(a: InteractionTraceFrame['reducerEffects'], b: InteractionTraceFrame['reducerEffects']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Pure reducer replay: Verify that the plan + inputState recorded by the frame is consistent with the output.
 */
export function replayTraceFrame(frame: InteractionTraceFrame): ReplayFrameResult {
  const reduced = reduceInteractionPlan(frame.inputState, frame.plan)
  const replayHash = hashInteractionState(reduced.state)

  const stateHashMatch = replayHash === frame.outputStateHash
  const effectsMatch = effectsEqual(reduced.effects, frame.reducerEffects)
  const commitFlagMatch = reduced.commit === frame.commit
  const focusFlagMatch = reduced.focus === frame.focus

  return {
    traceId: frame.traceId,
    ok: stateHashMatch && effectsMatch && commitFlagMatch && focusFlagMatch,
    stateHashMatch,
    effectsMatch,
    commitFlagMatch,
    focusFlagMatch,
    expectedOutputHash: frame.outputStateHash,
    replayOutputHash: replayHash,
  }
}

export function replayInteractionTrace(trace: InteractionTrace): ReplayTraceResult {
  const frames = trace.frames.map(replayTraceFrame)
  return {
    ok: frames.every((f) => f.ok),
    frames,
  }
}

/**
 * The replay results of executing the same frame input twice must be consistent (determinism proof).
 */
export function assertFrameDeterminism(frame: InteractionTraceFrame): boolean {
  const a = replayTraceFrame(frame)
  const b = replayTraceFrame(frame)
  return a.ok && b.ok && a.replayOutputHash === b.replayOutputHash
}

export function detectTraceDivergence(
  baseline: InteractionTrace,
  other: InteractionTrace,
): string[] {
  const issues: string[] = []
  const len = Math.min(baseline.frames.length, other.frames.length)
  for (let i = 0; i < len; i++) {
    const a = baseline.frames[i]!
    const b = other.frames[i]!
    if (a.outputStateHash !== b.outputStateHash) {
      issues.push(`frame ${a.traceId}: outputStateHash mismatch`)
    }
    if (!effectsEqual(a.reducerEffects, b.reducerEffects)) {
      issues.push(`frame ${a.traceId}: reducerEffects mismatch`)
    }
  }
  if (baseline.frames.length !== other.frames.length) {
    issues.push(`frame count mismatch: ${baseline.frames.length} vs ${other.frames.length}`)
  }
  return issues
}
