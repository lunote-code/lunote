import { invoke, isTauri } from '@tauri-apps/api/core'

export type WorkspaceEncryptionStatus = {
  enabled: boolean
  unlocked: boolean
  encryptImages: boolean
}

export const WORKSPACE_ENCRYPTION_CHANGED_EVENT = 'luna:workspace-encryption-changed'
export const WORKSPACE_ENCRYPTION_MIGRATION_PROGRESS_EVENT =
  'luna:workspace-encryption-migration-progress'

export const WORKSPACE_INDEX_PROGRESS_EVENT = 'luna:workspace-index-progress'

export type WorkspaceEncryptionMigrationProgress = {
  root: string
  phase: 'encrypting' | 'decrypting' | 'reencrypting' | string
  processed: number
  total: number
}

const WEB_ENCRYPTION_STATUS: WorkspaceEncryptionStatus = {
  enabled: false,
  unlocked: false,
  encryptImages: false,
}

function notifyWorkspaceEncryptionChanged(root: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_ENCRYPTION_CHANGED_EVENT, { detail: { root } }),
  )
}

export async function getWorkspaceEncryptionStatus(root: string): Promise<WorkspaceEncryptionStatus> {
  if (!isTauri()) return WEB_ENCRYPTION_STATUS
  return invoke('get_workspace_encryption_status', { payload: { root } })
}

export async function unlockWorkspace(root: string, password: string): Promise<void> {
  if (!isTauri()) return
  await invoke('unlock_workspace', { payload: { root, password } })
  notifyWorkspaceEncryptionChanged(root)
}

export async function decryptLegacyEncryptedImages(root: string): Promise<number> {
  if (!isTauri()) return 0
  return invoke<number>('decrypt_legacy_encrypted_images', { payload: { root } })
}

export async function setWorkspaceEncryptImages(root: string, enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const status = await getWorkspaceEncryptionStatus(root)
  if (!status.enabled) {
    throw new Error('Workspace encryption is not enabled')
  }
  if (!status.unlocked) {
    throw new Error('WORKSPACE_LOCKED')
  }
  await invoke('set_workspace_encrypt_images', { payload: { root, enabled } })
  notifyWorkspaceEncryptionChanged(root)
}

export async function lockWorkspace(root: string): Promise<void> {
  if (!isTauri()) return
  await invoke('lock_workspace', { payload: { root } })
  notifyWorkspaceEncryptionChanged(root)
}

export async function enableWorkspaceEncryption(root: string, password: string): Promise<void> {
  if (!isTauri()) return
  await invoke('enable_workspace_encryption', { payload: { root, password } })
  notifyWorkspaceEncryptionChanged(root)
}

export async function disableWorkspaceEncryption(root: string, password: string): Promise<void> {
  if (!isTauri()) return
  await invoke('disable_workspace_encryption', { payload: { root, password } })
  notifyWorkspaceEncryptionChanged(root)
}

export type WorkspaceIndexProgress = {
  root: string
  phase: 'reading' | 'writing' | string
  processed: number
  total: number
}

export async function cancelWorkspaceEncryptionMigration(root: string): Promise<void> {
  if (!isTauri()) return
  await invoke('cancel_workspace_encryption_migration', { payload: { root } })
}

export function isWorkspaceMigrationCancelledError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('WORKSPACE_MIGRATION_CANCELLED')
}

export async function changeWorkspaceEncryptionPassword(
  root: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!isTauri()) return
  await invoke('change_workspace_encryption_password', {
    payload: { root, currentPassword, newPassword },
  })
  notifyWorkspaceEncryptionChanged(root)
}

export function isWorkspaceLockedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('WORKSPACE_LOCKED')
}

export function isWorkspaceMigratingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('WORKSPACE_MIGRATING')
}

export function isIncorrectPasswordError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Incorrect password')
}
