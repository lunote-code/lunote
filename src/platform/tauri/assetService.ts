import { invoke } from '@tauri-apps/api/core'

export type SaveLunaAssetFilePayload = {
  workspaceId: string
  assetId: string
  originalName: string
  mimeType: string
  targetDir: string
  storageMode: string
  workspaceRoot: string
  dataBase64: string
}

export async function saveLunaAssetFile<TResponse>(payload: SaveLunaAssetFilePayload): Promise<TResponse> {
  return invoke<TResponse>('save_luna_asset_file', { payload })
}

const assetScopeRegistrations = new Map<string, Promise<void>>()
let lastRegisteredWorkspaceRoot: string | null = null

export async function ensureWorkspaceAssetScope(workspaceRoot: string): Promise<void> {
  const trimmedRoot = workspaceRoot.trim()
  if (!trimmedRoot) return
  if (lastRegisteredWorkspaceRoot === trimmedRoot) return
  const inflight = assetScopeRegistrations.get(trimmedRoot)
  if (inflight) return inflight
  const registration = invoke('register_workspace_asset_scope', { workspaceRoot: trimmedRoot })
    .then(() => {
      lastRegisteredWorkspaceRoot = trimmedRoot
    })
    .finally(() => {
      assetScopeRegistrations.delete(trimmedRoot)
    })
  assetScopeRegistrations.set(trimmedRoot, registration)
  await registration
}
