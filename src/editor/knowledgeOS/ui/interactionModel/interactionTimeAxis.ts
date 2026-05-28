import {
  projectStateAtFrameIndex,
  projectStateAtTraceId,
  projectionHashAtFrameIndex,
} from './interactionStateProjection'
import {
  createInitialInteractionKernelState,
  type InteractionKernelState,
} from './interactionKernelState'
import { hashInteractionState, type InteractionTraceFrame } from './interactionTraceModel'

export type InteractionTimeMode = 'live' | 'time-travel'

export type InteractionTimeAxisCursor = {
  mode: InteractionTimeMode
  /** -1 = No frame yet; always the last frame index when live.*/
  frameIndex: number
  traceId: string | null
}

export type InteractionTimelineSnapshot = {
  axisRevision: number
  mode: InteractionTimeMode
  frameIndex: number
  frameCount: number
  traceId: string | null
  kernelState: InteractionKernelState
  kernelStateHash: string
}

const MAX_TRACE_FRAMES = 128

let axisFrames: InteractionTraceFrame[] = []

function trimAxisFrames(): void {
  const overflow = axisFrames.length - MAX_TRACE_FRAMES
  if (overflow > 0) {
    axisFrames.splice(0, overflow)
    if (cursor.frameIndex >= 0) {
      cursor = {
        ...cursor,
        frameIndex: Math.max(0, cursor.frameIndex - overflow),
      }
    }
  }
}
let axisRevision = 0
let cursor: InteractionTimeAxisCursor = {
  mode: 'live',
  frameIndex: -1,
  traceId: null,
}
const axisListeners = new Set<() => void>()

function notifyAxis(): void {
  axisRevision += 1
  for (const fn of axisListeners) {
    fn()
  }
}

function syncCursorToLatest(): void {
  if (axisFrames.length === 0) {
    cursor = { mode: 'live', frameIndex: -1, traceId: null }
    return
  }
  const last = axisFrames.length - 1
  const frame = axisFrames[last]!
  cursor = { mode: 'live', frameIndex: last, traceId: frame.traceId }
}

export function resetInteractionTimeAxis(): void {
  axisFrames = []
  axisRevision = 0
  cursor = { mode: 'live', frameIndex: -1, traceId: null }
}

/** Called by recorder after IKTL finalize: timeline appends frames.*/
export function onInteractionTraceFrameCommitted(frame: InteractionTraceFrame): void {
  axisFrames.push(frame)
  trimAxisFrames()
  if (cursor.mode === 'live') {
    syncCursorToLatest()
  }
  notifyAxis()
}

export function getTimeAxisFrames(): readonly InteractionTraceFrame[] {
  return axisFrames
}

export function getTimeAxisCursor(): Readonly<InteractionTimeAxisCursor> {
  return cursor
}

export function getInteractionAxisRevision(): number {
  return axisRevision
}

export function getStateAtFrame(traceId: string): InteractionKernelState | null {
  return projectStateAtTraceId(axisFrames, traceId)
}

export function getLatestProjectedState(): InteractionKernelState {
  return projectStateAtFrameIndex(axisFrames, axisFrames.length - 1)
}

export function getCurrentProjectedState(): InteractionKernelState {
  return projectStateAtFrameIndex(axisFrames, cursor.frameIndex)
}

export function getLatestTraceFrame(): InteractionTraceFrame | null {
  if (axisFrames.length === 0) return null
  return axisFrames[axisFrames.length - 1]!
}

export function getInteractionTimelineSnapshot(): InteractionTimelineSnapshot {
  const kernelState =
    cursor.frameIndex >= 0
      ? getCurrentProjectedState()
      : createInitialInteractionKernelState()

  return {
    axisRevision,
    mode: cursor.mode,
    frameIndex: cursor.frameIndex,
    frameCount: axisFrames.length,
    traceId: cursor.traceId,
    kernelState,
    kernelStateHash: hashInteractionState(kernelState),
  }
}

export function rewindToFrame(traceId: string): boolean {
  const idx = axisFrames.findIndex((f) => f.traceId === traceId)
  if (idx < 0) return false
  cursor = { mode: 'time-travel', frameIndex: idx, traceId }
  notifyAxis()
  return true
}

export function advanceToFrameIndex(frameIndex: number): boolean {
  if (axisFrames.length === 0) return false
  const idx = Math.max(0, Math.min(frameIndex, axisFrames.length - 1))
  const frame = axisFrames[idx]!
  cursor = { mode: 'time-travel', frameIndex: idx, traceId: frame.traceId }
  notifyAxis()
  return true
}

export function resumeLiveTimeline(): void {
  syncCursorToLatest()
  cursor = { ...cursor, mode: 'live' }
  notifyAxis()
}

export function subscribeInteractionTimeAxis(listener: () => void): () => void {
  axisListeners.add(listener)
  return () => axisListeners.delete(listener)
}

/** CI: Verify that the projection hash of each frame on the timeline is consistent with the record.*/
export function assertTimelineProjectionIntegrity(): string[] {
  const issues: string[] = []
  for (let i = 0; i < axisFrames.length; i++) {
    const frame = axisFrames[i]!
    const projected = projectionHashAtFrameIndex(axisFrames, i)
    if (projected !== frame.outputStateHash) {
      issues.push(`frame ${frame.traceId}: projection hash mismatch at index ${i}`)
    }
  }
  return issues
}
