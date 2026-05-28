/**
 * OKFL — Single OS Kernel Clock: interaction frame ↔ knowledge revision unified tick.
 */
import { getKnowledgeRegistryRevision } from '../knowledgeRuntime'

export type OSKernelTickId = number

export type OSKernelTickSource =
  | 'interaction-commit'
  | 'knowledge-invalidate'
  | 'workspace'
  | 'time-travel'

export type OSKernelTickRecord = {
  tick: OSKernelTickId
  traceId: string | null
  frameIndex: number | null
  source: OSKernelTickSource
  knowledgeRegistryRevision: number
}

export type OSKernelClockMode = 'live' | 'time-travel'

let liveTick = 0
let cursorTick = 0
let cursorMode: OSKernelClockMode = 'live'
/** When time-traveling to a frame without commit binding, use the frame index projection.*/
let timeTravelFrameIndex: number | null = null
const MAX_TICK_LOG = 512

const tickLog: OSKernelTickRecord[] = []
const clockListeners = new Set<() => void>()

/** Effect scheduling side table (without changing the IKTL trace model). tick → scheduled effect index*/
const effectsByTick = new Map<OSKernelTickId, number>()

function trimTickLog(): void {
  const overflow = tickLog.length - MAX_TICK_LOG
  if (overflow <= 0) return
  const removed = tickLog.splice(0, overflow)
  for (const record of removed) {
    effectsByTick.delete(record.tick)
  }
}

function notifyClock(): void {
  for (const fn of clockListeners) {
    fn()
  }
}

function pushRecord(record: OSKernelTickRecord): void {
  tickLog.push(record)
  trimTickLog()
}

export function resetOSKernelClock(): void {
  liveTick = 0
  cursorTick = 0
  cursorMode = 'live'
  timeTravelFrameIndex = null
  tickLog.length = 0
  effectsByTick.clear()
  clockListeners.clear()
}

export function subscribeOSKernelClock(listener: () => void): () => void {
  clockListeners.add(listener)
  return () => clockListeners.delete(listener)
}

export function getLiveOSKernelTick(): OSKernelTickId {
  return liveTick
}

export function getCurrentOSKernelTick(): OSKernelTickId {
  return cursorMode === 'live' ? liveTick : cursorTick
}

export function getOSKernelClockMode(): OSKernelClockMode {
  return cursorMode
}

export function getOSKernelTickLog(): readonly OSKernelTickRecord[] {
  return tickLog
}

export function bumpLiveKernelTick(source: OSKernelTickSource, traceId: string | null = null): OSKernelTickId {
  liveTick += 1
  cursorTick = liveTick
  cursorMode = 'live'
  pushRecord({
    tick: liveTick,
    traceId,
    frameIndex: null,
    source,
    knowledgeRegistryRevision: getKnowledgeRegistryRevision(),
  })
  notifyClock()
  return liveTick
}

/** interaction commit: assign tick first, and complete frameIndex after frame submission.*/
export function advanceTickForInteractionCommit(traceId: string): OSKernelTickId {
  return bumpLiveKernelTick('interaction-commit', traceId)
}

export function completeInteractionCommitTick(traceId: string, frameIndex: number): void {
  for (let i = tickLog.length - 1; i >= 0; i--) {
    const record = tickLog[i]!
    if (record.traceId === traceId) {
      record.frameIndex = frameIndex
      return
    }
  }
}

export function mapFrameToRevision(frameId: string): OSKernelTickId | null {
  const record = tickLog.find((r) => r.traceId === frameId)
  return record?.tick ?? null
}

export function mapRevisionToFrame(revision: OSKernelTickId): string | null {
  const record = tickLog.find((r) => r.tick === revision && r.traceId != null)
  return record?.traceId ?? null
}

export function mapRevisionToFrameIndex(revision: OSKernelTickId): number | null {
  const record = tickLog.find((r) => r.tick === revision)
  return record?.frameIndex ?? null
}

/** The index of the interaction frame that is no more recent than ticks (knowledge-only tick fallback projection).*/
export function resolveFrameIndexAtOrBeforeTick(
  tick: OSKernelTickId,
  frameCount: number,
  getFrameCommitRevision: (frameIndex: number) => number | null,
): number {
  let best = -1
  for (let i = 0; i < frameCount; i++) {
    const rev = getFrameCommitRevision(i)
    if (rev != null && rev <= tick) {
      best = i
    }
  }
  return best
}

export function setKernelTickCursor(tick: OSKernelTickId): boolean {
  if (tick < 0 || tick > liveTick) return false
  cursorTick = tick
  cursorMode = tick === liveTick ? 'live' : 'time-travel'
  if (cursorMode === 'live') {
    timeTravelFrameIndex = null
  }
  notifyClock()
  return true
}

/** time-travel: bind tick (if there is a commit) and frame index.*/
export function enterTimeTravelAtFrame(tick: OSKernelTickId | null, frameIndex: number): void {
  cursorMode = 'time-travel'
  timeTravelFrameIndex = frameIndex
  if (tick != null && tick >= 0 && tick <= liveTick) {
    cursorTick = tick
  }
  notifyClock()
}

export function getTimeTravelFrameIndex(): number | null {
  return timeTravelFrameIndex
}

export function resumeLiveKernelClock(): void {
  cursorTick = liveTick
  cursorMode = 'live'
  timeTravelFrameIndex = null
  notifyClock()
}

export function noteEffectScheduledAtTick(tick: OSKernelTickId): void {
  const n = (effectsByTick.get(tick) ?? 0) + 1
  effectsByTick.set(tick, n)
}

export function getEffectCountAtTick(tick: OSKernelTickId): number {
  return effectsByTick.get(tick) ?? 0
}

export function assertTickKnowledgeConsistency(tick: OSKernelTickId): boolean {
  const record = tickLog.find((r) => r.tick === tick)
  if (!record) return tick === 0
  return record.knowledgeRegistryRevision <= getKnowledgeRegistryRevision()
}
