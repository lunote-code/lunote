import { autoLockDelayMs, shouldAttemptIdleAutoLock } from '../settings-runtime/workspaceAutoLock'

export type IdleAutoLockAttempt = {
  rootDir: string
  autoLockMinutes: number
  idleMs: number
}

export type IdleAutoLockResult = 'locked' | 'skipped' | 'save-failed' | 'unsaved-remaining' | 'lock-failed'

/** True only when autosave succeeded and no unique in-memory document work remains. */
export function idleLockAllowedAfterSave(
  saved: boolean,
  remainingDirtyPaths: readonly string[],
): boolean {
  return saved && remainingDirtyPaths.length === 0
}

export type IdleAutoLockDeps = {
  getStatus: (root: string) => Promise<{ enabled: boolean; unlocked: boolean }>
  saveDirtyDocuments: () => Promise<boolean>
  lockWorkspace: (root: string) => Promise<void>
  purgePlaintextSession: () => void
  ensureUnlocked: (root: string) => Promise<boolean>
  isStillCurrent: () => boolean
  /** Same workspace still loaded after native lock. Activity must not skip purge. */
  isWorkspaceStillOpen?: () => boolean
  listRemainingDirtyPaths?: () => readonly string[]
}

export async function lockWorkspaceAfterIdleWithDeps(
  attempt: IdleAutoLockAttempt,
  deps: IdleAutoLockDeps,
): Promise<IdleAutoLockResult> {
  const root = attempt.rootDir.trim()
  if (!root) return 'skipped'
  if (!deps.isStillCurrent()) return 'skipped'
  if (autoLockDelayMs(attempt.autoLockMinutes) == null) return 'skipped'

  const status = await deps.getStatus(root)
  if (!deps.isStillCurrent()) return 'skipped'
  if (
    !shouldAttemptIdleAutoLock({
      encryptionEnabled: status.enabled,
      unlocked: status.unlocked,
      autoLockMinutes: attempt.autoLockMinutes,
      idleMs: attempt.idleMs,
    })
  ) {
    return 'skipped'
  }

  const saved = await deps.saveDirtyDocuments()
  if (!deps.isStillCurrent()) return 'skipped'
  if (!saved) return 'save-failed'
  if (!idleLockAllowedAfterSave(true, deps.listRemainingDirtyPaths?.() ?? [])) {
    return 'unsaved-remaining'
  }

  try {
    await deps.lockWorkspace(root)
  } catch {
    return 'lock-failed'
  }

  const workspaceStillOpen = deps.isWorkspaceStillOpen?.() ?? deps.isStillCurrent()
  if (workspaceStillOpen) {
    deps.purgePlaintextSession()
    await deps.ensureUnlocked(root)
  }
  return 'locked'
}

