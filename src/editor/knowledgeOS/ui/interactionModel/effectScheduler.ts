import type { InteractionTraceFrame, TraceScheduledEffect } from './interactionTraceModel'

export type EffectReplayHandlers = {
  focus?: () => void
  scroll?: () => void
  onCancelScheduler?: () => void
  onArmHoverTimer?: (payload: {
    hoverEpoch: number
    key: string
    delayMs: number
  }) => void
  onCancelHoverTimer?: () => void
}

export type EffectReplayResult = {
  executed: TraceScheduledEffect[]
  skipped: TraceScheduledEffect[]
}

export type EffectScheduler = {
  scheduleFocus: (run: () => void) => void
  scheduleScroll: (run: () => void) => void
  cancelAll: () => void
  getSchedulerEpoch: () => number
}

export type EffectSchedulerOptions = {
  onTrace?: (effect: TraceScheduledEffect) => void
  /** OKFL: The effect is bound to the unified kernel tick (side table records, without changing the IKTL model).*/
  getKernelTick?: () => number
  onEffectKernelTick?: (tick: number) => void
}

export function traceEffect(
  kind: TraceScheduledEffect['kind'],
  schedulerEpoch: number,
  extra?: Partial<TraceScheduledEffect>,
): TraceScheduledEffect {
  return { kind, schedulerEpoch, ...extra } as TraceScheduledEffect
}

export function createEffectScheduler(options?: EffectSchedulerOptions): EffectScheduler {
  let epoch = 0
  const onTrace = options?.onTrace
  const getKernelTick = options?.getKernelTick
  const onEffectKernelTick = options?.onEffectKernelTick

  function emitTrace(effect: TraceScheduledEffect): void {
    onTrace?.(effect)
    const tick = getKernelTick?.()
    if (tick != null) {
      onEffectKernelTick?.(tick)
    }
  }

  function schedule(run: () => void, kind: 'scheduleFocus' | 'scheduleScroll'): void {
    const token = ++epoch
    emitTrace(traceEffect(kind, token))

    if (typeof requestAnimationFrame !== 'function') {
      if (token === epoch) run()
      return
    }
    requestAnimationFrame(() => {
      if (token !== epoch) return
      run()
    })
  }

  return {
    scheduleFocus: (run) => schedule(run, 'scheduleFocus'),
    scheduleScroll: (run) => schedule(run, 'scheduleScroll'),
    cancelAll() {
      epoch += 1
      emitTrace(traceEffect('cancelScheduler', epoch))
    },
    getSchedulerEpoch: () => epoch,
  }
}

/**
 * OKFL: Replay in kernel tick sequence (parsed by frame commit binding).
 */
export function replayScheduledEffectsAtKernelTick(
  tick: number,
  resolveFrameAtTick: (tick: number) => InteractionTraceFrame | null,
  handlers?: EffectReplayHandlers,
  options?: { logicalOnly?: boolean },
): EffectReplayResult {
  const frame = resolveFrameAtTick(tick)
  if (!frame) {
    return { executed: [], skipped: [] }
  }
  return replayScheduledEffectsFromFrame(frame, handlers, options)
}

/**
 * Logical replay in the order of scheduledEffects recorded in the trace frame (deterministic per frame).
 */
export function replayScheduledEffectsFromFrame(
  frame: InteractionTraceFrame,
  handlers?: EffectReplayHandlers,
  options?: { logicalOnly?: boolean },
): EffectReplayResult {
  const executed: TraceScheduledEffect[] = []
  const skipped: TraceScheduledEffect[] = []
  const logicalOnly = options?.logicalOnly ?? false

  for (const effect of frame.scheduledEffects) {
    switch (effect.kind) {
      case 'scheduleFocus':
        if (!logicalOnly && handlers?.focus) handlers.focus()
        executed.push(effect)
        break
      case 'scheduleScroll':
        if (!logicalOnly && handlers?.scroll) handlers.scroll()
        executed.push(effect)
        break
      case 'cancelScheduler':
        if (!logicalOnly && handlers?.onCancelScheduler) handlers.onCancelScheduler()
        executed.push(effect)
        break
      case 'armHoverTimer':
        if (!logicalOnly && handlers?.onArmHoverTimer) {
          handlers.onArmHoverTimer({
            hoverEpoch: effect.hoverEpoch,
            key: effect.key,
            delayMs: effect.delayMs,
          })
        }
        executed.push(effect)
        break
      case 'cancelHoverTimer':
        if (!logicalOnly && handlers?.onCancelHoverTimer) handlers.onCancelHoverTimer()
        executed.push(effect)
        break
      default:
        skipped.push(effect)
    }
  }

  return { executed, skipped }
}
