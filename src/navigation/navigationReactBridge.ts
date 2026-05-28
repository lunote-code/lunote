import { useSyncExternalStore } from 'react'
import {
  assertNavigationFactoryCaller,
  validateNavigationEvent,
  type NavigationEvent,
} from './navigationEventTypes'
import { appendEvent } from './navigationTimeline'
import {
  getNavigationMachineContext,
  subscribeNavigationMachine,
  type NavigationMachineContext,
} from './navigationStateMachine'
import { executeNavigationEvent } from './navigationExecutor'

export type NavigationUIProps = {
  activePath: string | null
  pendingPath: string | null
  isNavigating: boolean
  state: NavigationMachineContext['state']
  currentEventId: string | null
  error?: string
}

function isAgentLogEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const g = globalThis as { __KOS_AGENT_LOG__?: boolean }
  if (g.__KOS_AGENT_LOG__ === true) return true
  try {
    return localStorage.getItem('kos.agentLog') === '1'
  } catch {
    return false
  }
}

export function dispatchNavigationEvent(event: NavigationEvent): NavigationEvent {
  assertNavigationFactoryCaller()
  validateNavigationEvent(event)
  const appended = appendEvent(event)
  const traceId = typeof appended.meta?.traceId === 'string' ? appended.meta.traceId : appended.id
  if (isAgentLogEnabled()) {
    // #region agent log
    console.debug('[navigation-bridge]', { traceId, docKey: appended.docKey ?? null, resolvedPath: appended.path ?? null, root: null, eventType: appended.type, commandType: null, source: appended.source, eventId: appended.id })
    // #endregion
  }
  executeNavigationEvent(appended)
  return appended
}

export function mapNavigationStateToUIProps(
  context: NavigationMachineContext,
): NavigationUIProps {
  return {
    activePath: context.activePath,
    pendingPath: context.pendingPath,
    isNavigating: false,
    state: context.state,
    currentEventId: context.currentEventId,
  }
}

export function useNavigationUIProps(): NavigationUIProps {
  const context = useSyncExternalStore(
    subscribeNavigationMachine,
    getNavigationMachineContext,
    getNavigationMachineContext,
  )
  return mapNavigationStateToUIProps(context)
}
