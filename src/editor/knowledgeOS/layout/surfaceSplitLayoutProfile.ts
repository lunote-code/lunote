/**
 * Layout / GPU profiling：
 * - localStorage.kosSplitProfile = '1' or window.__KOS_SPLIT_PROFILE__
 * - window.__KOS_SPLIT_DEEP_PROFILE__ = true → frame / transform statistics per frame
 */
export type SurfaceSplitProfileSource = 'split' | 'editor' | 'graph' | 'observer' | 'tab'

type KosSplitWindow = Window & {
  __KOS_SPLIT_PROFILE__?: boolean
  __KOS_SPLIT_DEEP_PROFILE__?: boolean
}

let enabled =
  typeof localStorage !== 'undefined' && localStorage.getItem('kosSplitProfile') === '1'

let deepFrameStart = 0
let lastDeepFrameAt = 0
let transformUpdatesThisFrame = 0
let totalTransformUpdates = 0
let lastTransformValue = ''
let layerResetHeuristic = 0

function win(): KosSplitWindow | undefined {
  return typeof window !== 'undefined' ? (window as KosSplitWindow) : undefined
}

export function setSurfaceSplitProfileEnabled(on: boolean): void {
  enabled = on
  try {
    if (on) localStorage.setItem('kosSplitProfile', '1')
    else localStorage.removeItem('kosSplitProfile')
  } catch {
    /* ignore */
  }
}

export function isSurfaceSplitProfileEnabled(): boolean {
  const w = win()
  if (w?.__KOS_SPLIT_PROFILE__) return true
  return enabled
}

export function isSurfaceSplitDeepProfileEnabled(): boolean {
  const w = win()
  return Boolean(w?.__KOS_SPLIT_DEEP_PROFILE__ || w?.__KOS_SPLIT_PROFILE__)
}

export function profileLayoutRecalc(source: SurfaceSplitProfileSource, detail?: string): void {
  if (!isSurfaceSplitProfileEnabled() && !isSurfaceSplitDeepProfileEnabled()) return
   
  console.debug(`[kos-split-profile] ${source}`, detail ?? '', Math.round(performance.now()))
}

export function beginDeepProfileDrag(): void {
  if (!isSurfaceSplitDeepProfileEnabled()) return
  deepFrameStart = performance.now()
  lastDeepFrameAt = deepFrameStart
  transformUpdatesThisFrame = 0
  totalTransformUpdates = 0
  lastTransformValue = ''
  layerResetHeuristic = 0
  try {
    performance.mark('kos-split-drag-start')
  } catch {
    /* ignore */
  }
}

export function recordTransformPreview(transform: string): void {
  if (!isSurfaceSplitDeepProfileEnabled()) return
  transformUpdatesThisFrame += 1
  totalTransformUpdates += 1
  if (lastTransformValue && lastTransformValue !== transform) {
    layerResetHeuristic += 1
  }
  lastTransformValue = transform
}

export function flushDeepProfileFrame(scaleX: number, frozenWidth: number, previewWidth: number): void {
  if (!isSurfaceSplitDeepProfileEnabled()) return

  const now = performance.now()
  const frameTime = lastDeepFrameAt > 0 ? Math.round(now - lastDeepFrameAt) : 0
  lastDeepFrameAt = now

  try {
    performance.mark('kos-split-gpu-layer-check')
  } catch {
    /* ignore */
  }

   
  console.debug('[kos-split-profile]', {
    frameTime,
    paint: 'composite-only (transform)',
    composite: `scaleX(${scaleX})`,
    layerResetReason:
      layerResetHeuristic > 0 ? `transform-change×${layerResetHeuristic}` : 'none',
    triggerSource: 'rail',
    frozenWidth: Math.round(frozenWidth),
    previewWidth: Math.round(previewWidth),
    transformUpdates: transformUpdatesThisFrame,
    totalTransformUpdates,
    layoutInvalidation: 0,
  })

  transformUpdatesThisFrame = 0
}

export function endDeepProfileDrag(committedWidth: number): void {
  if (!isSurfaceSplitDeepProfileEnabled()) return
  const duration = Math.round(performance.now() - deepFrameStart)
  try {
    performance.mark('kos-split-drag-end')
    performance.measure('kos-split-drag', 'kos-split-drag-start', 'kos-split-drag-end')
  } catch {
    /* ignore */
  }
   
  console.debug('[kos-split-profile] drag-end', {
    durationMs: duration,
    totalTransformUpdates,
    committedWidth: Math.round(committedWidth),
    layerResets: layerResetHeuristic,
  })
  lastTransformValue = ''
}
