import { NavigationEventType, type NavigationEventSource } from './navigationEventTypes'
import { dispatchNavigationEvent } from './navigationReactBridge'
import { withNavigationFactoryContext } from './navigationRuntimeFirewall'
import { createNavigationEvent } from './navigationTimeline'

export function dispatchOpenNoteNavigation(
  path: string | undefined,
  source: NavigationEventSource,
  meta?: Record<string, unknown>,
) {
  return withNavigationFactoryContext(() =>
    dispatchNavigationEvent(createNavigationEvent({
      type: NavigationEventType.OPEN_NOTE,
      path,
      docKey: typeof meta?.docKey === 'string' ? meta.docKey : undefined,
      source,
      meta,
    })),
  )
}

export function dispatchOpenInTabNavigation(
  path: string,
  source: NavigationEventSource,
  meta?: Record<string, unknown>,
) {
  return withNavigationFactoryContext(() =>
    dispatchNavigationEvent(createNavigationEvent({
      type: NavigationEventType.OPEN_IN_TAB,
      path,
      source,
      meta,
    })),
  )
}

export function dispatchRestoreNavigation(
  source: NavigationEventSource,
  path?: string,
  meta?: Record<string, unknown>,
) {
  return withNavigationFactoryContext(() =>
    dispatchNavigationEvent(createNavigationEvent({
      type: NavigationEventType.RESTORE,
      path,
      source,
      meta,
    })),
  )
}

export function dispatchGraphFocusNavigation(
  docKey: string,
  meta?: Record<string, unknown>,
) {
  return withNavigationFactoryContext(() =>
    dispatchNavigationEvent(createNavigationEvent({
      type: NavigationEventType.GRAPH_FOCUS,
      docKey,
      source: 'graph',
      meta,
    })),
  )
}

export function dispatchBacklinkFocusNavigation(
  docKey: string,
  meta?: Record<string, unknown>,
) {
  return withNavigationFactoryContext(() =>
    dispatchNavigationEvent(createNavigationEvent({
      type: NavigationEventType.BACKLINK_FOCUS,
      docKey,
      source: 'backlink',
      meta,
    })),
  )
}
