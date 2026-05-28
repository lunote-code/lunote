export const NavigationEventType = {
  OPEN_NOTE: 'OPEN_NOTE',
  OPEN_IN_TAB: 'OPEN_IN_TAB',
  REVEAL: 'REVEAL',
  GRAPH_FOCUS: 'GRAPH_FOCUS',
  BACKLINK_FOCUS: 'BACKLINK_FOCUS',
  RESTORE: 'RESTORE',
} as const

export type NavigationEventType = typeof NavigationEventType[keyof typeof NavigationEventType]

export type NavigationEventSource =
  | 'graph'
  | 'backlink'
  | 'editor'
  | 'kernel'
  | 'workspace'
  | 'system'
  | 'menu'
  | 'file-tree'
  | 'wiki'
  | 'search'

export type NavigationEvent = {
  id: string
  type: NavigationEventType
  __source: 'navigationFactory'
  path?: string
  docKey?: string
  source: NavigationEventSource
  timestamp: number
  meta?: Record<string, unknown>
}

export {
  assertNavigationFactoryOnly as assertNavigationFactoryCaller,
  validateNavigationEvent,
} from './navigationRuntimeFirewall'
