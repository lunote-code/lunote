import { reduceInteractionPlan } from './interactionKernelReducer'
import {
  createInitialInteractionKernelState,
  type InteractionKernelState,
} from './interactionKernelState'
import {
  cloneInteractionState,
  hashInteractionState,
  type InteractionTraceFrame,
} from './interactionTraceModel'
import {
  mapRevisionToFrame,
  mapRevisionToFrameIndex,
  resolveFrameIndexAtOrBeforeTick,
  type OSKernelTickId,
} from '../../osKernelClock'

/** Single frame: trace recorded outputState (single source of truth).*/
export function projectStateFromFrame(frame: InteractionTraceFrame): InteractionKernelState {
  return cloneInteractionState(frame.outputState)
}

/** timeline[t]: Kernel state after the end of frameIndex frame.*/
export function projectStateAtFrameIndex(
  frames: readonly InteractionTraceFrame[],
  frameIndex: number,
): InteractionKernelState {
  if (frames.length === 0 || frameIndex < 0) {
    return createInitialInteractionKernelState()
  }
  const idx = Math.min(frameIndex, frames.length - 1)
  return projectStateFromFrame(frames[idx]!)
}

export function projectStateAtTraceId(
  frames: readonly InteractionTraceFrame[],
  traceId: string,
): InteractionKernelState | null {
  const idx = frames.findIndex((f) => f.traceId === traceId)
  if (idx < 0) return null
  return projectStateAtFrameIndex(frames, idx)
}

/**
 * Pure reducer chain replay: only relies on trace and does not read live runtime.
 * Used for determinism / CI verification.
 */
export function projectStateByReplayThroughIndex(
  frames: readonly InteractionTraceFrame[],
  frameIndex: number,
): InteractionKernelState {
  if (frames.length === 0 || frameIndex < 0) {
    return createInitialInteractionKernelState()
  }
  const idx = Math.min(frameIndex, frames.length - 1)
  let state = cloneInteractionState(frames[0]!.inputState)
  for (let i = 0; i <= idx; i++) {
    const reduced = reduceInteractionPlan(state, frames[i]!.plan)
    state = reduced.state
  }
  return state
}

export function projectionHashAtFrameIndex(
  frames: readonly InteractionTraceFrame[],
  frameIndex: number,
): string {
  return hashInteractionState(projectStateAtFrameIndex(frames, frameIndex))
}

export function assertReplayMatchesRecordedFrame(frame: InteractionTraceFrame): boolean {
  const replayed = projectStateByReplayThroughIndex([frame], 0)
  return hashInteractionState(replayed) === frame.outputStateHash
}

function getFrameCommitRevision(frames: readonly InteractionTraceFrame[], index: number): number | null {
  return frames[index]?.commitBinding?.osRevision ?? null
}

export { resolveFrameIndexAtOrBeforeTick }

/**
 * OKFL: Project interaction state according to unified OS kernel tick (do not read live runtime directly).
 */
export function projectStateAtKernelTick(
  tick: OSKernelTickId,
  frames: readonly InteractionTraceFrame[],
): InteractionKernelState {
  const directFrameIdx = mapRevisionToFrameIndex(tick)
  if (directFrameIdx != null && directFrameIdx >= 0 && frames[directFrameIdx]) {
    return projectStateAtFrameIndex(frames, directFrameIdx)
  }

  const traceId = mapRevisionToFrame(tick)
  if (traceId) {
    const byTrace = projectStateAtTraceId(frames, traceId)
    if (byTrace) return byTrace
  }

  const idx = resolveFrameIndexAtOrBeforeTick(tick, frames.length, (i) =>
    getFrameCommitRevision(frames, i),
  )
  return projectStateAtFrameIndex(frames, idx)
}

export function assertProjectionKnowledgeRevisionConsistency(
  tick: OSKernelTickId,
  frames: readonly InteractionTraceFrame[],
): boolean {
  const idx = resolveFrameIndexAtOrBeforeTick(tick, frames.length, (i) =>
    getFrameCommitRevision(frames, i),
  )
  if (idx < 0) return true
  const frame = frames[idx]
  if (!frame?.commitBinding) return true
  return frame.commitBinding.osRevision <= tick
}
