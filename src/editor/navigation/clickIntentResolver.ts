export type NavigationClickIntentType = 'graph' | 'backlink'

export type NavigationClickIntentReason =
  | 'ui_disabled'
  | 'hit_miss'
  | 'valid_click'

export type NavigationClickIntent = {
  type: NavigationClickIntentType
  allowDispatch: boolean
  reason?: NavigationClickIntentReason
  rawEvent: PointerEvent | MouseEvent
}

type EventLike = PointerEvent | MouseEvent | { nativeEvent: PointerEvent | MouseEvent }

type ResolveClickIntentInput = {
  type: NavigationClickIntentType
  event: EventLike
  uiDisabled?: boolean
  hitTestResult?: unknown | null
  meta?: Record<string, unknown>
}

function toRawEvent(event: EventLike): PointerEvent | MouseEvent {
  return 'nativeEvent' in event ? event.nativeEvent : event
}

export function resolveClickIntent(input: ResolveClickIntentInput): NavigationClickIntent {
  const {
    type,
    event,
    uiDisabled = false,
    hitTestResult,
    meta,
  } = input

  let allowDispatch = true
  let reason: NavigationClickIntentReason = 'valid_click'

  if (uiDisabled) {
    allowDispatch = false
    reason = 'ui_disabled'
  } else if (type === 'graph' && hitTestResult == null) {
    allowDispatch = false
    reason = 'hit_miss'
  } else if (type === 'graph' && hitTestResult != null) {
    const navigable =
      typeof hitTestResult === 'object' &&
      hitTestResult !== null &&
      'navigable' in hitTestResult
        ? Boolean((hitTestResult as { navigable?: boolean }).navigable)
        : true
    if (!navigable) {
      allowDispatch = false
      reason = 'hit_miss'
    }
  }

  console.assert(
    !(type === 'graph' && hitTestResult == null && allowDispatch),
    'GRAPH INVALID STATE',
  )
  console.assert(
    !(type === 'backlink' && uiDisabled && allowDispatch),
    'BACKLINK INVALID STATE',
  )

  const intent: NavigationClickIntent = {
    type,
    allowDispatch,
    reason,
    rawEvent: toRawEvent(event),
  }

  if (import.meta.env.DEV) {
    console.log('[NAV CLICK INTENT FINAL]', {
      type,
      allowDispatch,
      reason,
      meta: {
        hitTest: type === 'graph' ? hitTestResult != null : undefined,
        uiDisabled,
        ...meta,
      },
    })
  }

  return intent
}
