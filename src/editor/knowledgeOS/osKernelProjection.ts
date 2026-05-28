/**
 * OKFL — KnowledgeOSSnapshot = f(OSKernelClock)。
 */
import type { InteractionKernelState } from './ui/interactionModel/interactionKernelState'
import { hashInteractionState } from './ui/interactionModel/interactionTraceModel'
import {
  projectStateAtFrameIndex,
  projectStateAtKernelTick,
  resolveFrameIndexAtOrBeforeTick,
} from './ui/interactionModel/interactionStateProjection'
import { getTimeAxisFrames } from './ui/interactionModel/interactionTimeAxis'
import {
  assertTickKnowledgeConsistency,
  getCurrentOSKernelTick,
  getLiveOSKernelTick,
  getOSKernelClockMode,
  getTimeTravelFrameIndex,
  mapRevisionToFrame,
  type OSKernelTickId,
} from './osKernelClock'
import { getGraphViewportSnapshot, type GraphViewportSnapshot } from './graphViewportRuntime'
import { getSurfaceLayoutSnapshot, type SurfaceLayoutSnapshot } from './surfaceLayoutRuntime'

export type OSKernelTickInteractionView = {
  kernelState: InteractionKernelState
  kernelStateHash: string
}

export type OSKernelTickState = {
  tick: OSKernelTickId
  liveTick: OSKernelTickId
  mode: 'live' | 'time-travel'
  traceId: string | null
  frameIndex: number
  frameCount: number
  interaction: OSKernelTickInteractionView
  subsystemRevisions: {
    navigation: number
    graph: number
    search: number
    backlinks: number
    workspace: number
  }
  knowledgeConsistent: boolean
  surfaceLayout: SurfaceLayoutSnapshot
  graphViewport: GraphViewportSnapshot
}

function bindSubsystemSnapshotRevision<T extends { revision: number }>(
  snapshot: T,
  tick: OSKernelTickId,
): T {
  return { ...snapshot, revision: tick }
}

export function buildKernelTickState(): OSKernelTickState {
  const frames = getTimeAxisFrames()
  const tick = getCurrentOSKernelTick()
  const liveTick = getLiveOSKernelTick()
  const mode = getOSKernelClockMode()

  const travelIdx = getTimeTravelFrameIndex()
  const frameIndex =
    mode === 'time-travel' && travelIdx != null && travelIdx >= 0
      ? travelIdx
      : mode === 'live' && frames.length > 0
        ? frames.length - 1
        : resolveFrameIndexAtOrBeforeTick(tick, frames.length, (i) => {
            const f = frames[i]
            return f?.commitBinding?.osRevision ?? null
          })

  const kernelState =
    mode === 'time-travel' && travelIdx != null && travelIdx >= 0
      ? projectStateAtFrameIndex(frames, travelIdx)
      : mode === 'live' && frames.length > 0
        ? projectStateAtFrameIndex(frames, frames.length - 1)
        : projectStateAtKernelTick(tick, frames)

  const traceId =
    frameIndex >= 0 && frames[frameIndex] ? frames[frameIndex]!.traceId : mapRevisionToFrame(tick)

  return {
    tick,
    liveTick,
    mode,
    traceId,
    frameIndex,
    frameCount: frames.length,
    interaction: {
      kernelState,
      kernelStateHash: hashInteractionState(kernelState),
    },
    subsystemRevisions: {
      navigation: tick,
      graph: tick,
      search: tick,
      backlinks: tick,
      workspace: tick,
    },
    knowledgeConsistent: assertTickKnowledgeConsistency(tick),
    surfaceLayout: getSurfaceLayoutSnapshot(tick),
    graphViewport: getGraphViewportSnapshot(tick),
  }
}

export function projectUnifiedKnowledgeOSSlice<T extends { revision: number }>(
  snapshot: T,
  tick?: OSKernelTickId,
): T {
  return bindSubsystemSnapshotRevision(snapshot, tick ?? getCurrentOSKernelTick())
}
