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

export function dispatchNavigationEvent(event: NavigationEvent): NavigationEvent {
  assertNavigationFactoryCaller()
  validateNavigationEvent(event)
  const appended = appendEvent(event)
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
