import { pathsEqual } from '../../lib/workspacePathUtils'

/** True when opening a new root should tear down the currently loaded workspace. */
export function shouldLeavePreviousWorkspace(previousRoot: string, nextRoot: string): boolean {
  const previous = previousRoot.trim()
  const next = nextRoot.trim()
  return Boolean(previous) && Boolean(next) && !pathsEqual(previous, next)
}

/** Unlock cancel should only drop to idle when there was no prior workspace to restore. */
export function shouldResetWorkspaceSessionOnUnlockCancel(previousRoot: string): boolean {
  return !previousRoot.trim()
}
