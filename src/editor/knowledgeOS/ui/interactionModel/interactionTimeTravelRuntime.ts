import {
  enterTimeTravelAtFrame,
  getCurrentOSKernelTick,
  mapFrameToRevision,
  resumeLiveKernelClock,
} from '../../osKernelClock'
import { requestInteractionAxisOsInvalidation } from './interactionAxisOsBinding'
import { replayScheduledEffectsFromFrame } from './effectScheduler'
import {
  advanceToFrameIndex,
  getTimeAxisFrames,
  getTimeAxisCursor,
  resumeLiveTimeline,
  rewindToFrame,
} from './interactionTimeAxis'
import {
  projectStateAtKernelTick,
  projectStateByReplayThroughIndex,
} from './interactionStateProjection'
import type { InteractionTraceFrame } from './interactionTraceModel'
import type { InteractionKernelState } from './interactionKernelState'
import { hashInteractionState } from './interactionTraceModel'

export type InteractionTimeTravelMode = 'live' | 'paused' | 'time-travel' | 'replay'

let travelMode: InteractionTimeTravelMode = 'live'
let livePaused = false

export function getInteractionTimeTravelMode(): InteractionTimeTravelMode {
  return travelMode
}

export function isLiveInteractionPaused(): boolean {
  return livePaused
}

export function pauseLiveInteraction(): void {
  livePaused = true
  if (getTimeAxisCursor().mode === 'live') {
    travelMode = 'paused'
  }
  requestInteractionAxisOsInvalidation()
}

export function resumeLiveInteractionTimeline(): void {
  livePaused = false
  travelMode = 'live'
  resumeLiveTimeline()
  resumeLiveKernelClock()
  requestInteractionAxisOsInvalidation()
}

/**
 * Locate the timeline frame; pause live execution and the UI only renders the projected state.
 */
export function setInteractionFrame(traceId: string): boolean {
  pauseLiveInteraction()
  travelMode = 'time-travel'
  const frames = getTimeAxisFrames()
  const frameIndex = frames.findIndex((f) => f.traceId === traceId)
  const ok = rewindToFrame(traceId)
  if (ok && frameIndex >= 0) {
    enterTimeTravelAtFrame(mapFrameToRevision(traceId), frameIndex)
    requestInteractionAxisOsInvalidation()
  }
  return ok
}

export function setInteractionFrameIndex(frameIndex: number): boolean {
  pauseLiveInteraction()
  travelMode = 'time-travel'
  const ok = advanceToFrameIndex(frameIndex)
  const frame = getTimeAxisFrames()[frameIndex]
  if (ok) {
    enterTimeTravelAtFrame(frame?.commitBinding?.osRevision ?? null, frameIndex)
    requestInteractionAxisOsInvalidation()
  }
  return ok
}

export type FrameSequenceReplayResult = {
  ok: boolean
  framesReplayed: number
  finalStateHash: string
  issues: string[]
}

/**
 * Replay [fromTraceId, toTraceId] intervals in sequence (logical projection + scheduled effect recording).
 */
export function replayFrameSequence(
  fromTraceId: string,
  toTraceId: string,
): FrameSequenceReplayResult {
  const frames = getTimeAxisFrames()
  const fromIdx = frames.findIndex((f) => f.traceId === fromTraceId)
  const toIdx = frames.findIndex((f) => f.traceId === toTraceId)
  const issues: string[] = []

  if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) {
    return {
      ok: false,
      framesReplayed: 0,
      finalStateHash: hashInteractionState(
        projectStateAtKernelTick(0, getTimeAxisFrames()),
      ),
      issues: ['invalid frame range'],
    }
  }

  travelMode = 'replay'
  let lastState: InteractionKernelState = projectStateAtKernelTick(
    frames[fromIdx]?.commitBinding?.osRevision ?? 0,
    frames,
  )

  for (let i = fromIdx; i <= toIdx; i++) {
    const frame = frames[i]!
    const projected = projectStateByReplayThroughIndex(frames, i)
    if (hashInteractionState(projected) !== frame.outputStateHash) {
      issues.push(`frame ${frame.traceId}: replay hash mismatch`)
    }
    replayScheduledEffectsFromFrame(frame, undefined, { logicalOnly: true })
    lastState = projected
  }

  advanceToFrameIndex(toIdx)
  enterTimeTravelAtFrame(frames[toIdx]?.commitBinding?.osRevision ?? null, toIdx)
  requestInteractionAxisOsInvalidation()

  return {
    ok: issues.length === 0,
    framesReplayed: toIdx - fromIdx + 1,
    finalStateHash: hashInteractionState(lastState),
    issues,
  }
}

export function resetInteractionTimeTravel(): void {
  livePaused = false
  travelMode = 'live'
}

export function getProjectedInteractionStateForUI(): Readonly<InteractionKernelState> {
  return projectStateAtKernelTick(getCurrentOSKernelTick(), getTimeAxisFrames())
}

export function replayEffectsForCurrentFrame(
  handlers?: Parameters<typeof replayScheduledEffectsFromFrame>[1],
): ReturnType<typeof replayScheduledEffectsFromFrame> {
  const { frameIndex } = getTimeAxisCursor()
  const frames = getTimeAxisFrames()
  if (frameIndex < 0 || !frames[frameIndex]) {
    return { executed: [], skipped: [] }
  }
  return replayScheduledEffectsFromFrame(frames[frameIndex]!, handlers, { logicalOnly: false })
}

export function getCurrentTimelineFrame(): InteractionTraceFrame | null {
  const { frameIndex } = getTimeAxisCursor()
  const frames = getTimeAxisFrames()
  if (frameIndex < 0) return null
  return frames[frameIndex] ?? null
}
