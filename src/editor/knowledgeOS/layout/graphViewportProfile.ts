/**
 * Graph interaction profiling: localStorage.kosGraphProfile = '1' or window.__KOS_GRAPH_PROFILE__
 */
type KosGraphWindow = Window & { __KOS_GRAPH_PROFILE__?: boolean }

let enabled =
  typeof localStorage !== 'undefined' && localStorage.getItem('kosGraphProfile') === '1'

let layoutRecomputeCount = 0
let zoomTriggerLayout = false
let lastClickBlockingMs = 0
let lastNavigationDelayMs = 0

function win(): KosGraphWindow | undefined {
  return typeof window !== 'undefined' ? (window as KosGraphWindow) : undefined
}

export function isGraphProfileEnabled(): boolean {
  return Boolean(win()?.__KOS_GRAPH_PROFILE__ || enabled)
}

export function setGraphProfileEnabled(on: boolean): void {
  enabled = on
  try {
    if (on) localStorage.setItem('kosGraphProfile', '1')
    else localStorage.removeItem('kosGraphProfile')
  } catch {
    /* ignore */
  }
}

export function recordGraphLayoutRecompute(source: string): void {
  if (!isGraphProfileEnabled()) return
  layoutRecomputeCount += 1
  zoomTriggerLayout = true
   
  console.debug('[kos-graph-profile] layoutRecompute', source, layoutRecomputeCount)
}

export function recordGraphZoomFrame(triggeredLayout: boolean): void {
  if (!isGraphProfileEnabled()) return
   
  console.debug('[kos-graph-profile]', {
    zoomTriggerLayout: triggeredLayout,
    layoutRecomputeCount,
    clickBlockingTime: lastClickBlockingMs,
    navigationDelayMs: lastNavigationDelayMs,
  })
  if (!triggeredLayout) zoomTriggerLayout = false
}

export function recordGraphClick(blockingMs: number, navigationDelayMs: number): void {
  if (!isGraphProfileEnabled()) return
  lastClickBlockingMs = Math.round(blockingMs)
  lastNavigationDelayMs = Math.round(navigationDelayMs)
   
  console.debug('[kos-graph-profile]', {
    zoomTriggerLayout,
    clickBlockingTime: lastClickBlockingMs,
    layoutRecomputeCount,
    navigationDelayMs: lastNavigationDelayMs,
  })
}

export function resetGraphProfileFrame(): void {
  layoutRecomputeCount = 0
  zoomTriggerLayout = false
}
