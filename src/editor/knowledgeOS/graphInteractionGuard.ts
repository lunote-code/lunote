/**
 * Block graph ↔ navigation ↔ OS snapshot loop reentry.
 */
export type NavigationEndListener = (endedSessionVersion: number) => void

let isNavigating = false
let isGraphUpdating = false
let graphCallDepth = 0
let safeGraphFlushScheduled = false
const deferredSafeGraphUpdates: Array<() => void> = []

/** Each time beginNavigation is incremented; it is used to discard expired pending when flushing.*/
let navigationSessionVersion = 0
/** The currently ongoing navigation session (0 = None).*/
let activeNavigationSession = 0
/** UI click intent version (preserving order when quickly connecting points/discarding expired setTimeout).*/
let navigationIntentVersion = 0

const navigationEndListeners = new Set<NavigationEndListener>()
let navigationEndSingletonListener: NavigationEndListener | null = null

export function getNavigationSessionVersion(): number {
  return navigationSessionVersion
}

export function getActiveNavigationSession(): number {
  return activeNavigationSession
}

export function bumpNavigationIntentVersion(): number {
  navigationIntentVersion += 1
  return navigationIntentVersion
}

export function getNavigationIntentVersion(): number {
  return navigationIntentVersion
}

export function getIsKnowledgeNavigating(): boolean {
  return isNavigating
}

export function getIsGraphUpdating(): boolean {
  return isGraphUpdating
}

export function beginKnowledgeNavigation(): boolean {
  if (isNavigating) return false
  isNavigating = true
  navigationSessionVersion += 1
  activeNavigationSession = navigationSessionVersion
  return true
}

/** End navigation synchronously and dispatch navigationEnd all at once (disable microtask polling and waiting).*/
export function endKnowledgeNavigation(): void {
  if (!isNavigating) return
  const endedSession = activeNavigationSession
  isNavigating = false
  activeNavigationSession = 0
  for (const fn of navigationEndListeners) {
    fn(endedSession)
  }
}

/**
 * Singleton registration: the same listener is only registered once (anti-HMR/repeated import double flush).
 */
export function subscribeNavigationEndOnce(listener: NavigationEndListener): void {
  if (navigationEndSingletonListener === listener) return
  if (navigationEndSingletonListener) {
    navigationEndListeners.delete(navigationEndSingletonListener)
  }
  navigationEndSingletonListener = listener
  navigationEndListeners.add(listener)
}

/** @deprecated please use subscribeNavigationEndOnce*/
export function subscribeNavigationEnd(listener: NavigationEndListener): () => void {
  subscribeNavigationEndOnce(listener)
  return () => navigationEndListeners.delete(listener)
}

export function beginGraphUpdate(): boolean {
  if (isGraphUpdating) return false
  isGraphUpdating = true
  return true
}

export function endGraphUpdate(): void {
  isGraphUpdating = false
}

/** Bottom line: Limit graph runtime reentrancy depth.*/
export function safeGraphUpdate<T>(fn: () => T): T | undefined {
  if (graphCallDepth > 2) {
    deferredSafeGraphUpdates.push(() => {
      safeGraphUpdate(fn)
    })
    if (!safeGraphFlushScheduled) {
      safeGraphFlushScheduled = true
      queueMicrotask(() => {
        safeGraphFlushScheduled = false
        const queued = deferredSafeGraphUpdates.splice(0)
        for (const task of queued) task()
      })
    }
    return undefined
  }
  graphCallDepth += 1
  try {
    return fn()
  } finally {
    graphCallDepth -= 1
  }
}

export function resetGraphInteractionGuard(): void {
  isNavigating = false
  isGraphUpdating = false
  graphCallDepth = 0
  safeGraphFlushScheduled = false
  deferredSafeGraphUpdates.length = 0
  navigationSessionVersion = 0
  activeNavigationSession = 0
  navigationIntentVersion = 0
  navigationEndListeners.clear()
  navigationEndSingletonListener = null
}
