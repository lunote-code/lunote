/**
 * Graph camera stabilization — logical revision stabilization + layout phase aware physical convergence.
 */
import {
  clearLayoutPhysicsActivityWindow,
  commitFrameActivityToWindow,
  getLayoutPhase,
  hasRecentBurstActivity,
  isLayoutPhaseConverged,
  resetLayoutPhysicsHeartbeat,
  wasLastCommittedFrameBurst,
} from './graphLayoutPhysicsHeartbeat'

export type GraphCameraLockPhase = 'BOOT' | 'INITIAL_CENTERED' | 'STABILIZING' | 'STABLE'

/** Logical revision requires a continuous and stable number of frames (~500ms@60fps).*/
export const LAYOUT_QUIET_FRAME_THRESHOLD = 30

let phase: GraphCameraLockPhase = 'BOOT'
let navigationViewportOverrideCredits = 0
let revisionStableFrameCount = 0
let latestTopologyRevision = 0
let lastFrameTopologyRevision: number | null = null
let rafHandle = 0

function stopLayoutQuiescenceMonitor(): void {
  if (rafHandle !== 0) {
    cancelAnimationFrame(rafHandle)
    rafHandle = 0
  }
}

function resetLayoutQuiescence(revision: number): void {
  latestTopologyRevision = revision
  revisionStableFrameCount = 0
  lastFrameTopologyRevision = null
  clearLayoutPhysicsActivityWindow()
}

function enterStable(): void {
  if (phase !== 'STABILIZING') return
  phase = 'STABLE'
  stopLayoutQuiescenceMonitor()
}

/** Single frame stepping: phase-aware convergence + burst override revision count.*/
function stepLayoutQuiescence(): boolean {
  if (phase !== 'STABILIZING') return false

  commitFrameActivityToWindow()

  const revisionChanged = latestTopologyRevision !== lastFrameTopologyRevision
  if (revisionChanged) {
    lastFrameTopologyRevision = latestTopologyRevision
    revisionStableFrameCount = 0
    clearLayoutPhysicsActivityWindow()
  } else {
    revisionStableFrameCount += 1
  }

  const burstOverride =
    wasLastCommittedFrameBurst() || hasRecentBurstActivity()
  if (burstOverride) {
    revisionStableFrameCount = 0
  }

  const revisionStable = revisionStableFrameCount >= LAYOUT_QUIET_FRAME_THRESHOLD
  const physicsConverged = isLayoutPhaseConverged()

  if (revisionStable && physicsConverged && getLayoutPhase() === 'QUIET') {
    enterStable()
    return true
  }
  return false
}

function layoutQuiescenceTick(): void {
  rafHandle = 0
  if (stepLayoutQuiescence()) return
  if (phase !== 'STABILIZING') return
  rafHandle = requestAnimationFrame(layoutQuiescenceTick)
}

function startLayoutQuiescenceMonitor(): void {
  stopLayoutQuiescenceMonitor()
  rafHandle = requestAnimationFrame(layoutQuiescenceTick)
}

export function getGraphCameraLockPhase(): GraphCameraLockPhase {
  return phase
}

/** @deprecated use getRevisionStableFrameCount*/
export function getLayoutQuietCounter(): number {
  return revisionStableFrameCount
}

export function getRevisionStableFrameCount(): number {
  return revisionStableFrameCount
}

/** The viewport center triggered by navigation is not subject to STABLE restrictions (can be consumed multiple times).*/
export function overrideCameraLockOnce(): void {
  navigationViewportOverrideCredits = 1
}

export function overrideCameraLockForNavigationBurst(credits = 2): void {
  navigationViewportOverrideCredits = credits
}

export function shouldAllowNavigationViewportCenter(): boolean {
  if (navigationViewportOverrideCredits <= 0) return false
  navigationViewportOverrideCredits -= 1
  return true
}

export function resetGraphCameraLock(): void {
  stopLayoutQuiescenceMonitor()
  phase = 'BOOT'
  navigationViewportOverrideCredits = 0
  revisionStableFrameCount = 0
  latestTopologyRevision = 0
  lastFrameTopologyRevision = null
  resetLayoutPhysicsHeartbeat()
}

export function shouldAllowAutoViewportCenter(): boolean {
  return phase === 'BOOT'
}

export function shouldAllowExplicitViewportCenter(): boolean {
  return phase === 'STABLE'
}

export function onAutoViewportBoundsCentered(): void {
  if (phase !== 'BOOT') return
  phase = 'INITIAL_CENTERED'
  phase = 'STABILIZING'
  startLayoutQuiescenceMonitor()
}

export function notifyGraphTopologyRevisionChanged(revision: number): void {
  resetLayoutQuiescence(revision)
  if (phase === 'STABILIZING' && rafHandle === 0) {
    startLayoutQuiescenceMonitor()
  }
}

export function notifyGraphLayoutComplete(revision: number): void {
  notifyGraphTopologyRevisionChanged(revision)
}

/** @internal test: single-step frame silent determination*/
export function __stepLayoutQuiescenceForTests(): void {
  stepLayoutQuiescence()
}

/** @internal for testing*/
export function __setGraphCameraLockPhaseForTests(
  next: GraphCameraLockPhase,
  options?: { startMonitor?: boolean },
): void {
  stopLayoutQuiescenceMonitor()
  phase = next
  revisionStableFrameCount = 0
  lastFrameTopologyRevision = null
  if (next === 'STABILIZING' && options?.startMonitor !== false) {
    startLayoutQuiescenceMonitor()
  }
}
