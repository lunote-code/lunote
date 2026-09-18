const NEAR_BOTTOM_THRESHOLD = 64
const BOTTOM_SCROLL_PASSES = 8

let scrollElement: HTMLElement | null = null
let scrollGuardCleanup: (() => void) | null = null
let scrollContextKey: string | null = null
const scrollTopByContextKey = new Map<string, number>()
let savedScrollTop = 0
let pendingRestoreTop: number | null = null
let bottomScrollPassesRemaining = 0
let pinBottomUntilStreamingIdle = false
let userCancelledSendBottomPin = false
let isRestoring = false
let restoreGeneration = 0

function maxScrollTop(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.clientHeight)
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function snapshotIsFarFromBottom(el: HTMLElement, top: number): boolean {
  return maxScrollTop(el) - top >= NEAR_BOTTOM_THRESHOLD
}

/** Layout churn pulled scroll upward — keep the saved reading position. */
function isRegressiveScrollReset(el: HTMLElement, liveTop: number): boolean {
  return (
    !isRestoring &&
    savedScrollTop > NEAR_BOTTOM_THRESHOLD &&
    liveTop + NEAR_BOTTOM_THRESHOLD < savedScrollTop &&
    maxScrollTop(el) > NEAR_BOTTOM_THRESHOLD
  )
}

/** Focus/layout churn can briefly zero scrollTop — keep the saved reading position. */
function isSpuriousScrollReset(el: HTMLElement, liveTop: number): boolean {
  return (
    liveTop === 0 &&
    savedScrollTop > 0 &&
    maxScrollTop(el) > NEAR_BOTTOM_THRESHOLD &&
    snapshotIsFarFromBottom(el, savedScrollTop)
  )
}

function clearSendBottomPin(): void {
  pinBottomUntilStreamingIdle = false
  bottomScrollPassesRemaining = 0
  restoreGeneration += 1
}

function cancelSendBottomPin(): void {
  userCancelledSendBottomPin = true
  clearSendBottomPin()
}

function persistSavedScrollToContext(): void {
  if (scrollContextKey) {
    scrollTopByContextKey.set(scrollContextKey, savedScrollTop)
  }
}

function loadSavedScrollFromContext(key: string | null): void {
  if (key && scrollTopByContextKey.has(key)) {
    savedScrollTop = scrollTopByContextKey.get(key) ?? 0
    pendingRestoreTop = savedScrollTop
    return
  }
  savedScrollTop = 0
  pendingRestoreTop = null
}

/** Remember scroll per conversation doc key when switching notes or remounting the rail. */
export function setAiRailScrollContextKey(key: string | null): void {
  if (scrollContextKey === key) return
  if (scrollElement?.isConnected) {
    syncAiRailScrollSnapshot()
  }
  if (scrollContextKey) {
    scrollTopByContextKey.set(scrollContextKey, savedScrollTop)
  }
  scrollContextKey = key
  loadSavedScrollFromContext(key)
  if (scrollElement?.isConnected && !shouldPinAiRailScrollToBottom()) {
    restoreAiRailScrollSnapshot()
  }
}

function runScrollPasses(apply: () => void): void {
  const generation = ++restoreGeneration
  const run = () => {
    if (generation !== restoreGeneration) return
    apply()
  }
  run()
  queueMicrotask(run)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run)
    requestAnimationFrame(() => requestAnimationFrame(run))
  }
}

function scheduleScrollToBottom(): void {
  const el = scrollElement
  if (!el?.isConnected) return
  const target = maxScrollTop(el)
  runScrollPasses(() => {
    if (!el.isConnected) return
    if (!shouldPinAiRailScrollToBottom()) return
    isRestoring = true
    try {
      if (Math.abs(el.scrollTop - target) > 1) {
        el.scrollTop = target
      }
      savedScrollTop = el.scrollTop
      persistSavedScrollToContext()
    } finally {
      isRestoring = false
    }
  })
}

function scheduleScrollRestore(): void {
  const el = scrollElement
  if (!el?.isConnected) return
  const resolvedTop = pendingRestoreTop ?? savedScrollTop
  pendingRestoreTop = null
  const maxTop = maxScrollTop(el)
  const target = Math.min(resolvedTop, maxTop)
  if (target + 1 < resolvedTop) {
    pendingRestoreTop = resolvedTop
    // Wait for scrollHeight to catch up — never snap to a transient partial max.
    return
  }
  runScrollPasses(() => {
    if (!el.isConnected) return
    isRestoring = true
    try {
      el.scrollTop = target
      if (Math.abs(el.scrollTop - resolvedTop) <= 1) {
        savedScrollTop = el.scrollTop
        persistSavedScrollToContext()
      }
    } finally {
      isRestoring = false
    }
  })
}

/** Pin the rail to the bottom across send layout passes and until streaming settles. */
export function requestAiRailScrollToBottom(): void {
  userCancelledSendBottomPin = false
  pinBottomUntilStreamingIdle = true
  bottomScrollPassesRemaining = BOTTOM_SCROLL_PASSES
  scheduleScrollToBottom()
}

/** Release send-time bottom pin once the assistant stream finishes. */
export function notifyAiRailStreamingIdle(): void {
  if (userCancelledSendBottomPin) {
    clearSendBottomPin()
    return
  }
  pinBottomUntilStreamingIdle = false
  bottomScrollPassesRemaining = Math.max(bottomScrollPassesRemaining, BOTTOM_SCROLL_PASSES)
  scheduleScrollToBottom()
}

const SCROLL_GUARD_FOCUS_SELECTOR =
  '.ai-right-rail, .ProseMirror, .cm-editor, .cm-content, .tiptap-editor-content, .editor-main, .main-with-rail, .editor-right-rail-container, .kos-right-rail, .kos-frontmatter-panel, .kos-frontmatter-title-input'

function shouldGuardAiRailScrollSideEffect(target: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false
  if (!scrollElement?.isConnected || shouldPinAiRailScrollToBottom()) return false
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest(SCROLL_GUARD_FOCUS_SELECTOR)) return true
  if (!(target instanceof Node)) return false
  const node = target instanceof Element ? target : target.parentElement
  return !!node?.closest(SCROLL_GUARD_FOCUS_SELECTOR)
}

function isClipboardEditingShortcut(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false
  const key = event.key.toLowerCase()
  return key === 'a' || key === 'c' || key === 'x' || key === 'v' || key === 'z' || key === 's'
}

function guardAiRailScrollBeforeSideEffect(): void {
  if (!scrollElement?.isConnected || shouldPinAiRailScrollToBottom()) return
  captureAiRailScrollSnapshotForRestore()
  scheduleAiRailScrollRestoreAfterSideEffects()
}

function bindAiRailScrollSideEffectGuards(): () => void {
  if (typeof document === 'undefined') return () => {}
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isClipboardEditingShortcut(event)) return
    if (!shouldGuardAiRailScrollSideEffect(event.target)) return
    guardAiRailScrollBeforeSideEffect()
  }
  const onClipboard = (event: Event) => {
    if (!shouldGuardAiRailScrollSideEffect(event.target)) return
    guardAiRailScrollBeforeSideEffect()
  }
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('copy', onClipboard, true)
  document.addEventListener('cut', onClipboard, true)
  document.addEventListener('paste', onClipboard, true)
  return () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('copy', onClipboard, true)
    document.removeEventListener('cut', onClipboard, true)
    document.removeEventListener('paste', onClipboard, true)
  }
}

function syncAiRailScrollSideEffectGuards(): void {
  if (scrollElement?.isConnected) {
    if (!scrollGuardCleanup) {
      scrollGuardCleanup = bindAiRailScrollSideEffectGuards()
    }
    return
  }
  scrollGuardCleanup?.()
  scrollGuardCleanup = null
}

/** @internal Resets module state between unit tests. */
export function __resetAiRailScrollPreserveForTests(): void {
  scrollGuardCleanup?.()
  scrollGuardCleanup = null
  scrollElement = null
  scrollContextKey = null
  scrollTopByContextKey.clear()
  savedScrollTop = 0
  pendingRestoreTop = null
  bottomScrollPassesRemaining = 0
  pinBottomUntilStreamingIdle = false
  userCancelledSendBottomPin = false
  isRestoring = false
  restoreGeneration = 0
}

export function registerAiRailScrollElement(el: HTMLElement | null): void {
  if (scrollElement?.isConnected && !el?.isConnected) {
    syncAiRailScrollSnapshot()
    persistSavedScrollToContext()
  }
  scrollElement = el
  syncAiRailScrollSideEffectGuards()
  if (!el?.isConnected) return
  if (pendingRestoreTop !== null || savedScrollTop > 0 || shouldPinAiRailScrollToBottom()) {
    restoreAiRailScrollSnapshot()
    return
  }
  syncAiRailScrollSnapshot()
}

export function shouldPinAiRailScrollToBottom(): boolean {
  return pinBottomUntilStreamingIdle || bottomScrollPassesRemaining > 0
}

/** Persist the live scroll position (e.g. on user scroll). */
export function syncAiRailScrollSnapshot(): { top: number } {
  const el = scrollElement
  if (!el) return { top: savedScrollTop }
  const liveTop = el.scrollTop
  if (!isRestoring && pendingRestoreTop !== null && liveTop + NEAR_BOTTOM_THRESHOLD < pendingRestoreTop) {
    return { top: savedScrollTop }
  }
  if (!isRestoring && isSpuriousScrollReset(el, liveTop)) {
    return { top: savedScrollTop }
  }
  if (pinBottomUntilStreamingIdle && distanceFromBottom(el) >= NEAR_BOTTOM_THRESHOLD) {
    const maxTop = maxScrollTop(el)
    const wasNearBottom = maxTop - savedScrollTop <= NEAR_BOTTOM_THRESHOLD
    const userScrolledUpFromBottom =
      wasNearBottom && liveTop + NEAR_BOTTOM_THRESHOLD < maxTop
    if (userScrolledUpFromBottom || bottomScrollPassesRemaining === 0) {
      cancelSendBottomPin()
    }
  } else if (bottomScrollPassesRemaining > 0 && distanceFromBottom(el) >= NEAR_BOTTOM_THRESHOLD) {
    bottomScrollPassesRemaining = 0
    restoreGeneration += 1
  }
  if (!isRestoring) {
    savedScrollTop = liveTop
    persistSavedScrollToContext()
  }
  return { top: savedScrollTop }
}

/** Pin reading position before layout/focus side effects. */
export function captureAiRailScrollSnapshotForRestore(): void {
  const el = scrollElement
  if (
    pendingRestoreTop !== null &&
    el?.isConnected &&
    el.scrollTop + NEAR_BOTTOM_THRESHOLD < pendingRestoreTop
  ) {
    savedScrollTop = pendingRestoreTop
    return
  }
  if (el?.isConnected && (isSpuriousScrollReset(el, el.scrollTop) || isRegressiveScrollReset(el, el.scrollTop))) {
    pendingRestoreTop = savedScrollTop
    return
  }
  syncAiRailScrollSnapshot()
  pendingRestoreTop = savedScrollTop
  persistSavedScrollToContext()
}

/** Right-rail tab hides AI panel — remember scroll position. */
export function notifyAiRailPanelHidden(): void {
  captureAiRailScrollSnapshotForRestore()
}

/** Right-rail tab shows AI panel — restore reading position. */
export function notifyAiRailPanelVisible(): void {
  restoreAiRailScrollSnapshot()
}

/** Restore saved reading position, or follow bottom while sending/streaming. */
export function restoreAiRailScrollSnapshot(): void {
  if (shouldPinAiRailScrollToBottom()) {
    if (bottomScrollPassesRemaining > 0) {
      bottomScrollPassesRemaining -= 1
    }
    scheduleScrollToBottom()
    return
  }
  scheduleScrollRestore()
}

/** Run a synchronous mutation without losing the current reading position. */
export function preserveAiRailScrollDuring(fn: () => void): void {
  captureAiRailScrollSnapshotForRestore()
  fn()
  restoreAiRailScrollSnapshot()
}

/** Re-apply reading position after async commits (save, kernel snapshot, deferred layout). */
export function scheduleAiRailScrollRestoreAfterSideEffects(): void {
  restoreAiRailScrollSnapshot()
  queueMicrotask(() => {
    restoreAiRailScrollSnapshot()
  })
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      restoreAiRailScrollSnapshot()
      requestAnimationFrame(() => {
        restoreAiRailScrollSnapshot()
      })
    })
  }
}
