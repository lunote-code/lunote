import { invoke } from '@tauri-apps/api/core'

import { pathCompareKey, pathsEqual } from '../../lib/workspacePathUtils'

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
const registeredAssetScopeRoots = new Set<string>()
let lastRegisteredWorkspaceRoot: string | null = null

function rememberRegisteredAssetScopeRoot(workspaceRoot: string): void {
  registeredAssetScopeRoots.add(pathCompareKey(workspaceRoot))
  lastRegisteredWorkspaceRoot = workspaceRoot
}

export async function ensureWorkspaceAssetScope(workspaceRoot: string): Promise<void> {
  const trimmedRoot = workspaceRoot.trim()
  if (!trimmedRoot) return
  if (lastRegisteredWorkspaceRoot && pathsEqual(lastRegisteredWorkspaceRoot, trimmedRoot)) return
  const scopeKey = pathCompareKey(trimmedRoot)
  const inflight = assetScopeRegistrations.get(scopeKey)
  if (inflight) return inflight
  const registration = invoke('register_workspace_asset_scope', { workspaceRoot: trimmedRoot })
    .then(() => {
      rememberRegisteredAssetScopeRoot(trimmedRoot)
    })
    .finally(() => {
      assetScopeRegistrations.delete(scopeKey)
    })
  assetScopeRegistrations.set(scopeKey, registration)
  await registration
}

export async function forbidWorkspaceAssetScope(workspaceRoot: string): Promise<void> {
  const trimmedRoot = workspaceRoot.trim()
  if (!trimmedRoot) return
  const scopeKey = pathCompareKey(trimmedRoot)
  if (!registeredAssetScopeRoots.has(scopeKey)) return
  await invoke('forbid_workspace_asset_scope', { workspaceRoot: trimmedRoot }).catch(() => undefined)
  registeredAssetScopeRoots.delete(scopeKey)
  if (lastRegisteredWorkspaceRoot && pathsEqual(lastRegisteredWorkspaceRoot, trimmedRoot)) {
    lastRegisteredWorkspaceRoot = null
  }
}

export function getRegisteredAssetScopeRootCountForTests(): number {
  return registeredAssetScopeRoots.size
}

export function resetAssetScopeRegistryForTests(): void {
  assetScopeRegistrations.clear()
  registeredAssetScopeRoots.clear()
  lastRegisteredWorkspaceRoot = null
}
