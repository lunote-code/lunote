export type * from './types'
export {
  INTERACTION_STEP_ORDER,
  buildInteractionPlan,
  composeInteractions,
  dedupeInteractionSteps,
  normalizeInteractionSteps,
  sortStepsByRuleOrder,
} from './planner'
export {
  coalesceInteractionPlanQueue,
  collapseInteractionIntents,
  mergeInteractionPlans,
} from './planNormalizer'
export {
  reduceInteractionPlan,
  type InteractionEffect,
  type InteractionReduceResult,
} from './interactionKernelReducer'
export type {
  HoverState,
  InteractionKernelState,
  NavigationState,
  SelectionState,
} from './interactionKernelState'
export { createInitialInteractionKernelState } from './interactionKernelState'
export { commitInteractionState } from './interactionCommit'
export type { CommitTraceBinding } from './interactionCommit'
export {
  createEffectScheduler,
  traceEffect,
  replayScheduledEffectsFromFrame,
  replayScheduledEffectsAtKernelTick,
} from './effectScheduler'
export type { EffectReplayHandlers, EffectReplayResult } from './effectScheduler'
export type { InteractionTimelineSnapshot } from './interactionTimeAxis'
export {
  getTimeAxisFrames,
  getTimeAxisCursor,
  getStateAtFrame,
  getLatestProjectedState,
  getCurrentProjectedState,
  getLatestTraceFrame,
  getInteractionTimelineSnapshot,
  getInteractionAxisRevision,
  rewindToFrame,
  advanceToFrameIndex,
  resumeLiveTimeline,
  subscribeInteractionTimeAxis,
  resetInteractionTimeAxis,
  assertTimelineProjectionIntegrity,
} from './interactionTimeAxis'
export type { InteractionTimeMode, InteractionTimeAxisCursor } from './interactionTimeAxis'
export {
  projectStateFromFrame,
  projectStateAtFrameIndex,
  projectStateAtTraceId,
  projectStateAtKernelTick,
  projectStateByReplayThroughIndex,
  projectionHashAtFrameIndex,
  assertReplayMatchesRecordedFrame,
  assertProjectionKnowledgeRevisionConsistency,
} from './interactionStateProjection'
export {
  setInteractionFrame,
  setInteractionFrameIndex,
  pauseLiveInteraction,
  resumeLiveInteractionTimeline,
  isLiveInteractionPaused,
  getInteractionTimeTravelMode,
  replayFrameSequence,
  resetInteractionTimeTravel,
  getProjectedInteractionStateForUI,
  replayEffectsForCurrentFrame,
  getCurrentTimelineFrame,
} from './interactionTimeTravelRuntime'
export type { InteractionTimeTravelMode, FrameSequenceReplayResult } from './interactionTimeTravelRuntime'
export {
  getCurrentOSKernelTick,
  getLiveOSKernelTick,
  mapFrameToRevision,
  mapRevisionToFrame,
  mapRevisionToFrameIndex,
} from '../../osKernelClock'
export type * from './interactionTraceModel'
export {
  hashInteractionState,
  stableSerialize,
  cloneInteractionState,
  createEmptyInteractionTrace,
} from './interactionTraceModel'
export {
  resetInteractionTraceLog,
  getInteractionTraceLog,
  getInteractionTraceFrame,
  beginInteractionTraceFrame,
  finalizeInteractionTraceFrame,
  getCurrentLogicalEpoch,
  getLastTraceFrame,
} from './interactionTraceRecorder'
export {
  replayTraceFrame,
  replayInteractionTrace,
  assertFrameDeterminism,
  detectTraceDivergence,
} from './interactionTraceReplay'
export {
  cancelHoverEffect,
  executeInteractionPlan,
  getInteractionKernelState,
  getLiveExecutorKernelState,
  resetInteractionExecutorState,
  reducePlanForTest,
} from './kernelExecutor'

import type { InteractionExecutionReport, InteractionIntent } from './types'
import { buildInteractionPlan, composeInteractions } from './planner'
import { executeInteractionPlan } from './kernelExecutor'

/** intent → plan → reduce → commit → effect tail */
export function executeKnowledgeIntent(intent: InteractionIntent): InteractionExecutionReport {
  return executeInteractionPlan(buildInteractionPlan(intent))
}

export function executeKnowledgeIntents(intents: InteractionIntent[]): InteractionExecutionReport {
  return executeInteractionPlan(composeInteractions(intents))
}
