import {
  decryptLegacyEncryptedImages,
  getWorkspaceEncryptionStatus,
  isIncorrectPasswordError,
  unlockWorkspace,
} from '../platform/tauri/workspaceEncryptionService'
import { syncWorkspaceImageEncryptionFromStatus } from './workspaceImageEncryptionRuntime'

export type WorkspacePasswordPromptOptions = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  requireConfirm?: boolean
  initialError?: string
}

export type WorkspacePasswordPrompt = (
  options: WorkspacePasswordPromptOptions,
) => Promise<{ password: string; confirmPassword?: string } | null>

export type WorkspaceUnlockDeps = {
  getStatus: (root: string) => Promise<{ enabled: boolean; unlocked: boolean }>
  unlock: (root: string, password: string) => Promise<void>
  isIncorrectPassword: (error: unknown) => boolean
  migrateLegacyEncryptedImages?: (root: string) => Promise<void>
}

const legacyMigrationInFlight = new Map<string, Promise<void>>()

async function migrateLegacyEncryptedImagesIfNeeded(
  root: string,
  status: { enabled: boolean; unlocked: boolean },
  migrate?: (root: string) => Promise<void>,
): Promise<void> {
  if (!status.enabled || !status.unlocked) return

  const inflight = legacyMigrationInFlight.get(root)
  if (inflight) {
    await inflight
    return
  }

  const runner =
    migrate ??
    (async (workspaceRoot) => {
      await decryptLegacyEncryptedImages(workspaceRoot)
    })

  const task = runner(root)
    .catch((error) => {
      console.warn('[workspace] legacy_encrypted_images_migration_failed', { root, error })
    })
    .finally(() => {
      legacyMigrationInFlight.delete(root)
    })

  legacyMigrationInFlight.set(root, task)
  await task
}

export async function ensureWorkspaceUnlockedWithDeps(
  root: string,
  promptPassword: WorkspacePasswordPrompt,
  t: (key: string, params?: Record<string, string | number>) => string,
  deps: WorkspaceUnlockDeps,
): Promise<boolean> {
  const status = await deps.getStatus(root)
  syncWorkspaceImageEncryptionFromStatus(status)
  if (!status.enabled || status.unlocked) {
    await migrateLegacyEncryptedImagesIfNeeded(root, status, deps.migrateLegacyEncryptedImages)
    return true
  }

  let lastError: string | undefined
  for (;;) {
    const result = await promptPassword({
      title: t('workspace.encryption.unlock.title'),
      message: t('workspace.encryption.unlock.message'),
      confirmLabel: t('workspace.encryption.unlock.confirm'),
      cancelLabel: t('app.rename.cancel'),
      initialError: lastError,
    })
    if (!result) return false
    try {
      await deps.unlock(root, result.password)
      const unlockedStatus = await deps.getStatus(root)
      syncWorkspaceImageEncryptionFromStatus(unlockedStatus)
      await migrateLegacyEncryptedImagesIfNeeded(root, unlockedStatus, deps.migrateLegacyEncryptedImages)
      return true
    } catch (error) {
      lastError = deps.isIncorrectPassword(error)
        ? t('workspace.encryption.error.incorrectPassword')
        : error instanceof Error
          ? error.message
          : String(error)
    }
  }
}

export async function ensureWorkspaceUnlocked(
  root: string,
  promptPassword: WorkspacePasswordPrompt,
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<boolean> {
  return ensureWorkspaceUnlockedWithDeps(root, promptPassword, t, {
    getStatus: getWorkspaceEncryptionStatus,
    unlock: unlockWorkspace,
    isIncorrectPassword: isIncorrectPasswordError,
  })
}

/** @internal test helper */
export function resetLegacyMigrationInFlightForTests(): void {
  legacyMigrationInFlight.clear()
}
