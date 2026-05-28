import { isAnySelectionLocked } from '../../nativeInput/selectionCycle'
import { isNativeInputTarget } from './nativeInputBoundary'
import { isNativeInputAuthorityHeld } from './nativeInputAuthority'
import {
  isNativeInputActive,
  isNativeInputComposing,
  shouldRuntimeYieldToNativeInput,
} from './nativeInputRuntime'

export type RuntimeBypassReason =
  | 'native-input-target'
  | 'native-input-active'
  | 'native-input-composing'
  | 'native-input-authority'

/**
 * PM/block/viewport/scheduler must be called before disposing pointer.
 * @returns true = runtime must be bypassed (no preventDefault, no focus/selection)
 */
export function shouldBypassRuntimeForTarget(target: EventTarget | null): boolean {
  if (isNativeInputTarget(target)) return true
  if (isNativeInputActive()) return true
  return false
}

export function shouldBypassRuntimeForBlock(blockId: string | null): boolean {
  if (!isNativeInputActive()) return false
  return shouldRuntimeYieldToNativeInput(blockId)
}

export function shouldBypassPmSelectionSync(): boolean {
  if (isNativeInputAuthorityHeld()) return true
  if (isNativeInputActive()) return true
  return false
}

export function shouldBypassRuntimeSchedulerTask(
  blockId?: string | null,
  kind?: 'render' | 'layout' | 'selection' | 'viewport' | 'async',
): boolean {
  if (isAnySelectionLocked()) {
    return kind === 'selection' || kind === 'layout' || kind === 'viewport'
  }
  if (!shouldRuntimeYieldToNativeInput(blockId)) return false
  if (isNativeInputComposing()) return true
  return kind === 'selection' || kind === 'viewport'
}

/** PM handleDOMEvents: return false = do not intercept, leave it to the browser*/
export function bypassRuntimePointer(): false {
  return false
}

export function shouldBlockRuntimeSelectionCommit(): boolean {
  return isNativeInputAuthorityHeld() || isNativeInputActive() || isAnySelectionLocked()
}

export function shouldBlockRuntimeFocusSteal(): boolean {
  return isNativeInputAuthorityHeld()
}
