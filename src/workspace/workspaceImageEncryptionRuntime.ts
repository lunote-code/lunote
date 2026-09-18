/** Runtime mirror of workspace encryption metadata `encryptImages` for sync UI gates. */
let workspaceImageEncryptionEnabled = false

export function isWorkspaceImageEncryptionEnabled(): boolean {
  return workspaceImageEncryptionEnabled
}

export function setWorkspaceImageEncryptionEnabled(enabled: boolean): void {
  workspaceImageEncryptionEnabled = enabled
}

export function syncWorkspaceImageEncryptionFromStatus(status: {
  enabled: boolean
  encryptImages?: boolean
}): void {
  setWorkspaceImageEncryptionEnabled(Boolean(status.enabled && status.encryptImages))
}
