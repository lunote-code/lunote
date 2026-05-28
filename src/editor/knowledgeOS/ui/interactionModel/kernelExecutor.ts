import {
  getActiveNavigationEvent,
  recordNavigationSideEffect,
} from '../../../../navigation/navigationEventValidator'
import { dispatchOpenNoteNavigation } from '../../../../navigation/navigationFactory'
import { navigateToWikiLink } from '../../noteNavigationRuntime'
import { getKnowledgeInteractionHost } from '../knowledgeInteractionHost'
import { hideWikiHover, showWikiHover } from '../KnowledgeHoverCard'
import { commitInteractionState } from './interactionCommit'
import { createEffectScheduler } from './effectScheduler'
import {
  createInitialInteractionKernelState,
  type InteractionKernelState,
} from './interactionKernelState'
import { reduceInteractionPlan, type InteractionEffect } from './interactionKernelReducer'
import { coalesceInteractionPlanQueue } from './planNormalizer'
import {
  beginInteractionTraceFrame,
  finalizeInteractionTraceFrame,
  recordHostEffectTrace,
  recordReducerTrace,
  recordScheduledEffectTrace,
  resetInteractionTraceLog,
} from './interactionTraceRecorder'
import {
  getCurrentOSKernelTick,
  getLiveOSKernelTick,
  noteEffectScheduledAtTick,
  resetOSKernelClock,
} from '../../osKernelClock'
import { projectStateAtFrameIndex, projectStateAtKernelTick } from './interactionStateProjection'
import { getOSKernelClockMode } from '../../osKernelClock'
import { getTimeAxisFrames, resetInteractionTimeAxis } from './interactionTimeAxis'
import { isLiveInteractionPaused, resetInteractionTimeTravel } from './interactionTimeTravelRuntime'
import type { TraceScheduledEffect } from './interactionTraceModel'
import type {
  InteractionEffectResult,
  InteractionExecutionReport,
  InteractionIntent,
  InteractionPlan,
} from './types'

const HOVER_DELAY_MS = 280

let kernelState: InteractionKernelState = createInitialInteractionKernelState()
let executing = false
const planQueue: InteractionPlan[] = []
let hoverTimer: ReturnType<typeof setTimeout> | null = null
let activeHoverId: string | null = null
let currentTraceId: string | null = null

function onScheduledEffectTrace(effect: TraceScheduledEffect): void {
  recordScheduledEffectTrace(effect)
}

let effectScheduler = createEffectScheduler({
  onTrace: onScheduledEffectTrace,
  getKernelTick: () => getLiveOSKernelTick(),
  onEffectKernelTick: (tick) => noteEffectScheduledAtTick(tick),
})

function rebuildEffectScheduler(): void {
  effectScheduler = createEffectScheduler({
    onTrace: onScheduledEffectTrace,
    getKernelTick: () => getLiveOSKernelTick(),
    onEffectKernelTick: (tick) => noteEffectScheduledAtTick(tick),
  })
}

function resolveAbsolutePath(intent: InteractionIntent): string | null {
  if (intent.absolutePath) return intent.absolutePath
  if (intent.searchHit?.absolutePath) return intent.searchHit.absolutePath
  if (intent.target) return navigateToWikiLink(intent.target, intent.source)?.absolutePath ?? null
  if (intent.docKey) return navigateToWikiLink({ docKey: intent.docKey }, intent.source)?.absolutePath ?? null
  return null
}

function clearHoverTimer(): void {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
    recordScheduledEffectTrace({ kind: 'cancelHoverTimer', schedulerEpoch: effectScheduler.getSchedulerEpoch() })
  }
}

function runHostEffect(effect: InteractionEffect): InteractionEffectResult {
  const h = getKnowledgeInteractionHost()

  switch (effect.type) {
    case 'hideHover': {
      clearHoverTimer()
      if (activeHoverId) {
        hideWikiHover(activeHoverId)
        activeHoverId = null
      }
      h?.onHoverIdChange(null)
      return { ok: true }
    }

    case 'armHover': {
      if (kernelState.navigation.active) return { ok: true }
      const { intent, epoch, key } = effect
      const target = intent.target
      const pointer = intent.pointer
      if (!target || !pointer) return { ok: false }

      clearHoverTimer()
      recordScheduledEffectTrace({
        kind: 'armHoverTimer',
        schedulerEpoch: effectScheduler.getSchedulerEpoch(),
        hoverEpoch: epoch,
        key,
        delayMs: HOVER_DELAY_MS,
      })

      hoverTimer = setTimeout(() => {
        hoverTimer = null
        if (kernelState.navigation.active) return
        if (kernelState.hover.pending?.epoch !== epoch) return
        if (kernelState.hover.pending?.key !== key) return
        if (activeHoverId) hideWikiHover(activeHoverId)
        activeHoverId = showWikiHover(target, pointer.x, pointer.y)
        h?.onHoverIdChange(activeHoverId)
      }, HOVER_DELAY_MS)
      return { ok: true }
    }

    case 'clearSelection':
      h?.clearEditorSelection()
      return { ok: true }

    case 'closeOverlay':
      return { ok: true }

    case 'navigate': {
      const { intent } = effect
      const rootDir = h?.getRootDir() ?? null
      if (!h) return { ok: false }
      if (intent.target) {
        const entry = navigateToWikiLink(intent.target, intent.source)
        recordNavigationSideEffect(getActiveNavigationEvent(), {
          kind: 'kernelNavigate',
          source: intent.source === 'graph' || intent.source === 'backlink' || intent.source === 'editor'
            ? intent.source
            : 'kernel',
          docKey: intent.target.docKey,
          path: entry?.absolutePath ?? undefined,
          meta: {
            hasRootDir: Boolean(rootDir),
            willOpenPath: Boolean(rootDir && entry?.absolutePath),
          },
        })
        if (!rootDir) return { ok: false }
        if (!entry?.absolutePath) return { ok: false }
        h.openAbsolutePath(entry.absolutePath)
        dispatchOpenNoteNavigation(entry.absolutePath, 'kernel', {
          docKey: intent.target.docKey,
          heading: intent.target.heading,
          blockId: intent.target.blockId,
        })
        recordNavigationSideEffect(getActiveNavigationEvent(), {
          kind: 'openAbsolutePath',
          source: 'kernel',
          docKey: intent.target.docKey,
          path: entry.absolutePath,
        })
        return { ok: true }
      }
      const absolutePath = resolveAbsolutePath(intent)
      recordNavigationSideEffect(getActiveNavigationEvent(), {
        kind: 'kernelNavigate',
        source: intent.source === 'graph' || intent.source === 'backlink' || intent.source === 'editor'
          ? intent.source
          : 'kernel',
        docKey: intent.docKey,
        path: absolutePath ?? undefined,
        meta: {
          hasRootDir: Boolean(rootDir),
          willOpenPath: Boolean(rootDir && absolutePath),
        },
      })
      if (!rootDir) return { ok: false }
      if (!absolutePath) return { ok: false }
      h.openAbsolutePath(absolutePath)
      dispatchOpenNoteNavigation(absolutePath, 'kernel', {
        docKey: intent.docKey,
      })
      recordNavigationSideEffect(getActiveNavigationEvent(), {
        kind: 'openAbsolutePath',
        source: 'kernel',
        docKey: intent.docKey,
        path: absolutePath,
      })
      return { ok: true }
    }

    case 'openSearchModal':
      h?.openSearchModal()
      return { ok: true }

    default:
      return { ok: false }
  }
}

function runPlan(plan: InteractionPlan): InteractionExecutionReport {
  const inputState = kernelState
  currentTraceId = beginInteractionTraceFrame(plan, inputState)

  const reduced = reduceInteractionPlan(kernelState, plan)
  kernelState = reduced.state

  recordReducerTrace(kernelState, reduced.effects, reduced.commit, reduced.focus)

  const results: InteractionEffectResult[] = []
  for (const fx of reduced.effects) {
    const result = runHostEffect(fx)
    recordHostEffectTrace(fx, result.ok)
    results.push(result)
  }

  let commitBinding = null
  if (reduced.commit && currentTraceId) {
    commitBinding = commitInteractionState(currentTraceId)
  }

  if (reduced.focus) {
    effectScheduler.scheduleFocus(() => getKnowledgeInteractionHost()?.focusEditor())
  }

  finalizeInteractionTraceFrame(commitBinding)

  const traceId = currentTraceId
  currentTraceId = null

  return { plan, results, traceId: traceId ?? undefined }
}

export function executeInteractionPlan(plan: InteractionPlan): InteractionExecutionReport {
  if (isLiveInteractionPaused()) {
    return { plan, results: [] }
  }

  planQueue.push(plan)

  if (executing) {
    return { plan, results: [] }
  }

  executing = true
  effectScheduler.cancelAll()
  clearHoverTimer()

  let lastReport: InteractionExecutionReport = { plan, results: [] }

  try {
    while (planQueue.length > 0) {
      const batch = coalesceInteractionPlanQueue(planQueue.splice(0, planQueue.length))
      if (batch.steps.length === 0) continue
      lastReport = runPlan(batch)
    }
  } finally {
    executing = false
  }

  return lastReport
}

export function cancelHoverEffect(): void {
  const intent: InteractionIntent = {
    type: 'hover_end',
    source: 'wiki',
    pointer: { x: 0, y: 0 },
  }
  executeInteractionPlan({
    intents: [intent],
    steps: [{ kind: 'cancelHover', intent }],
  })
}

export function resetInteractionExecutorState(): void {
  clearHoverTimer()
  effectScheduler.cancelAll()
  rebuildEffectScheduler()
  if (activeHoverId) {
    hideWikiHover(activeHoverId)
    activeHoverId = null
  }
  kernelState = createInitialInteractionKernelState()
  executing = false
  planQueue.length = 0
  currentTraceId = null
  resetInteractionTraceLog()
  resetInteractionTimeAxis()
  resetInteractionTimeTravel()
  resetOSKernelClock()
}

/** UI/Debugging: OKFL projection; live takes the latest frame, time-travel takes the clock cursor.*/
export function getInteractionKernelState(): Readonly<InteractionKernelState> {
  const frames = getTimeAxisFrames()
  if (getOSKernelClockMode() === 'live' && frames.length > 0) {
    return projectStateAtFrameIndex(frames, frames.length - 1)
  }
  return projectStateAtKernelTick(getCurrentOSKernelTick(), frames)
}

export function getLiveExecutorKernelState(): Readonly<InteractionKernelState> {
  return kernelState
}

export function reducePlanForTest(state: InteractionKernelState, plan: InteractionPlan) {
  return reduceInteractionPlan(state, plan)
}
