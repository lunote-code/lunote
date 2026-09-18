import { pathsEqual } from '../lib/workspacePathUtils'
import {
  isIncorrectPasswordError,
  isWorkspaceLockedError,
  isWorkspaceMigratingError,
} from '../platform/tauri/workspaceEncryptionService'

export function formatWorkspaceEncryptionErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string | null {
  if (isWorkspaceMigratingError(error)) {
    return t('workspace.encryption.error.migrating')
  }
  if (isWorkspaceLockedError(error)) {
    return t('workspace.encryption.error.locked')
  }
  if (isIncorrectPasswordError(error)) {
    return t('workspace.encryption.error.incorrectPassword')
  }
  return null
}

export function shouldRetrySaveAfterWorkspaceUnlock(
  error: unknown,
  allowUnlockRetry: boolean,
  hasPrompt: boolean,
): boolean {
  return allowUnlockRetry && hasPrompt && isWorkspaceLockedError(error)
}

/** Save was queued for a previous workspace root; do not unlock or write against the current session. */
export function shouldAbortStaleWorkspaceSave(
  rootAtRequest: string,
  currentRootDir: string,
): boolean {
  const req = rootAtRequest.trim()
  const cur = currentRootDir.trim()
  if (!req || !cur) return false
  return !pathsEqual(req, cur)
}
