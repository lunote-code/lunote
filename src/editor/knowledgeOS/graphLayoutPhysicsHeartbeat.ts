/**
 * Layout physical layer heartbeat: sliding window activity + stage-aware convergence (INIT / BURST / RELAXING / QUIET).
 */

export type LayoutPhysicsActivityKind =
  | 'force-tick'
  | 'collision-resolve'
  | 'node-position'
  | 'edge-spline'
  | 'transform-pan'
  | 'grid-layout'
  | 'force-layout'
  | 'layout-scheduled'
  | 'layout-complete'

export type LayoutPhase = 'INIT' | 'BURST' | 'RELAXING' | 'QUIET'

/** Window length aligned with camera LAYOUT_QUIET_FRAME_THRESHOLD.*/
export const LAYOUT_PHYSICS_WINDOW_SIZE = 30

/** QUIET phase activity upper limit.*/
export const LAYOUT_PHYSICS_ACTIVITY_THRESHOLD = 0.05

/** A single frame score exceeding this value is considered a BURST spike.*/
export const LAYOUT_BURST_SCORE_THRESHOLD = 0.6

/** STABLE requires no burst within the last N frames.*/
export const LAYOUT_BURST_LOOKBACK_FRAMES = 10

/** QUIET The number of frames required for a continuous downward trend.*/
export const LAYOUT_QUIET_DECLINE_FRAMES = 5

/** The minimum number of window samples required to determine RELAXING.*/
const MIN_PHASE_SAMPLES = 3

const BURST_ACTIVITY_KINDS = new Set<LayoutPhysicsActivityKind>([
  'force-tick',
  'collision-resolve',
])

const ACTIVITY_SCORE_BY_KIND: Record<LayoutPhysicsActivityKind, number> = {
  'node-position': 0.6,
  'force-tick': 0.5,
  'collision-resolve': 0.5,
  'edge-spline': 0.3,
  'transform-pan': 0.1,
  'grid-layout': 0.5,
  'force-layout': 0.5,
  'layout-scheduled': 0.3,
  'layout-complete': 0.5,
}

const layoutPhysicsActivityWindow: number[] = []
const burstFrameHistory: boolean[] = []

let layoutPhase: LayoutPhase = 'INIT'
let currentFrameActivityScore = 0
let currentFrameBurstKindHits = 0
let quietDeclineStreak = 0
let lastCommittedFrameWasBurst = false

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score))
}

function isBurstActivityFrame(score: number): boolean {
  return score >= LAYOUT_BURST_SCORE_THRESHOLD || currentFrameBurstKindHits >= 2
}

function recordBurstFrame(isBurst: boolean): void {
  burstFrameHistory.push(isBurst)
  if (burstFrameHistory.length > LAYOUT_BURST_LOOKBACK_FRAMES) {
    burstFrameHistory.shift()
  }
}

function hasDecliningTrend(samples: readonly number[], minLen = 3): boolean {
  if (samples.length < minLen) return false
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]! > samples[i - 1]! + 1e-6) return false
  }
  return samples[0]! > samples[samples.length - 1]!
}

function updateLayoutPhase(frameScore: number, isBurstFrame: boolean): void {
  const prevScore =
    layoutPhysicsActivityWindow.length >= 2
      ? layoutPhysicsActivityWindow[layoutPhysicsActivityWindow.length - 2]!
      : frameScore

  if (frameScore < prevScore) {
    quietDeclineStreak += 1
  } else {
    quietDeclineStreak = 0
  }

  if (isBurstFrame) {
    layoutPhase = 'BURST'
    return
  }

  if (layoutPhysicsActivityWindow.length < MIN_PHASE_SAMPLES) {
    layoutPhase = 'INIT'
    return
  }

  const recent = layoutPhysicsActivityWindow.slice(-LAYOUT_QUIET_DECLINE_FRAMES)
  const decliningQuiet =
    frameScore < LAYOUT_PHYSICS_ACTIVITY_THRESHOLD &&
    quietDeclineStreak >= LAYOUT_QUIET_DECLINE_FRAMES &&
    hasDecliningTrend(recent, Math.min(LAYOUT_QUIET_DECLINE_FRAMES, recent.length))

  if (decliningQuiet) {
    layoutPhase = 'QUIET'
    return
  }

  const relaxingSamples = layoutPhysicsActivityWindow.slice(-4)
  const relaxingTrend = hasDecliningTrend(relaxingSamples, 3)
  if (
    relaxingTrend &&
    frameScore >= LAYOUT_PHYSICS_ACTIVITY_THRESHOLD
  ) {
    layoutPhase = 'RELAXING'
    return
  }

  if (relaxingTrend && frameScore < LAYOUT_PHYSICS_ACTIVITY_THRESHOLD) {
    layoutPhase = 'RELAXING'
    return
  }

  layoutPhase = 'INIT'
}

/** Accumulate physical activity intensity to the current frame (can be called multiple times, upper limit 1).*/
export function markLayoutPhysicsActivity(kind: LayoutPhysicsActivityKind): void {
  const delta = ACTIVITY_SCORE_BY_KIND[kind] ?? 0.3
  currentFrameActivityScore = clampScore(currentFrameActivityScore + delta)
  if (BURST_ACTIVITY_KINDS.has(kind)) {
    currentFrameBurstKindHits += 1
  }
}

/** RAF step: submit the score of this frame, update stage, and return the score of this frame.*/
export function commitFrameActivityToWindow(): number {
  const score = clampScore(currentFrameActivityScore)
  const isBurstFrame = isBurstActivityFrame(score)

  layoutPhysicsActivityWindow.push(score)
  if (layoutPhysicsActivityWindow.length > LAYOUT_PHYSICS_WINDOW_SIZE) {
    layoutPhysicsActivityWindow.shift()
  }

  recordBurstFrame(isBurstFrame)
  updateLayoutPhase(score, isBurstFrame)

  lastCommittedFrameWasBurst = isBurstFrame
  currentFrameActivityScore = 0
  currentFrameBurstKindHits = 0
  return score
}

export function getLayoutPhase(): LayoutPhase {
  return layoutPhase
}

export function getLayoutPhysicsActivityWindow(): readonly number[] {
  return layoutPhysicsActivityWindow
}

export function getLayoutActivityWindowAverage(): number {
  if (layoutPhysicsActivityWindow.length === 0) return 1
  const sum = layoutPhysicsActivityWindow.reduce((a, b) => a + b, 0)
  return sum / layoutPhysicsActivityWindow.length
}

export function wasLastCommittedFrameBurst(): boolean {
  return lastCommittedFrameWasBurst
}

export function hasRecentBurstActivity(
  lookback = LAYOUT_BURST_LOOKBACK_FRAMES,
): boolean {
  if (burstFrameHistory.length === 0) return false
  const slice = burstFrameHistory.slice(-lookback)
  return slice.some(Boolean)
}

/** Phase-aware physical convergence: QUIET and no recent burst.*/
export function isLayoutPhaseConverged(): boolean {
  return layoutPhase === 'QUIET' && !hasRecentBurstActivity()
}

/** @deprecated Use isLayoutPhaseConverged; reserved for diagnostics.*/
export function isPhysicsLowPassStable(
  threshold = LAYOUT_PHYSICS_ACTIVITY_THRESHOLD,
): boolean {
  return (
    layoutPhysicsActivityWindow.length >= LAYOUT_PHYSICS_WINDOW_SIZE &&
    getLayoutActivityWindowAverage() < threshold
  )
}

export function clearLayoutPhysicsActivityWindow(): void {
  layoutPhysicsActivityWindow.length = 0
  burstFrameHistory.length = 0
  currentFrameActivityScore = 0
  currentFrameBurstKindHits = 0
  quietDeclineStreak = 0
  lastCommittedFrameWasBurst = false
  layoutPhase = 'INIT'
}

export function resetLayoutPhysicsHeartbeat(): void {
  clearLayoutPhysicsActivityWindow()
}

const POSITION_EPS = 1e-4

/** @internal test: directly submit the specified activity score*/
export function __commitFrameActivityScoreForTests(score: number): number {
  currentFrameActivityScore = clampScore(score)
  return commitFrameActivityToWindow()
}

export function markLayoutPhysicsIfNodePositionsChanged(
  prev: readonly { x: number; y: number }[],
  next: readonly { x: number; y: number }[],
): void {
  if (prev.length !== next.length) {
    markLayoutPhysicsActivity('node-position')
    return
  }
  for (let i = 0; i < next.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (!a || !b) {
      markLayoutPhysicsActivity('node-position')
      return
    }
    if (
      Math.abs(a.x - b.x) > POSITION_EPS ||
      Math.abs(a.y - b.y) > POSITION_EPS
    ) {
      markLayoutPhysicsActivity('node-position')
      return
    }
  }
}
