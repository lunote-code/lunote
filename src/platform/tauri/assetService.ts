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

export async function registerWorkspaceAssetScope(workspaceRoot: string): Promise<void> {
  await invoke('register_workspace_asset_scope', { workspaceRoot })
}
