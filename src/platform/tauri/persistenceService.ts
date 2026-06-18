import { invoke } from '@tauri-apps/api/core'

export type LunaWorkspaceSnapshotRecord = {
  workspaceId: string
  rootDir: string
  activePath: string | null
  openTabs: string[]
  graphViewport?: { x: number; y: number; zoom: number } | null
  lastNavigationTarget?: string | null
  updatedAt: number
}

export type AssetMetaRecord = {
  id: string
  originalName: string
  relativePath: string
  absolutePath: string
  resolvedPath?: string
  storageMode?: string
  mimeType: string
  createdAt: number
  referenceCount?: number
  lastReferencedAt?: number
}

export type AssetIndexRecord = {
  assets: Record<string, AssetMetaRecord>
}

export async function readLunaWorkspace(
  workspaceId: string,
): Promise<LunaWorkspaceSnapshotRecord | null> {
  return invoke<LunaWorkspaceSnapshotRecord | null>('read_luna_workspace', {
    payload: { workspaceId },
  })
}

export async function writeLunaWorkspace(
  workspaceId: string,
  snapshot: LunaWorkspaceSnapshotRecord,
): Promise<void> {
  await invoke('write_luna_workspace', {
    payload: {
      workspaceId,
      snapshot,
    },
  })
}

export type LunaLogFileKind = 'app' | 'crash'

export async function appendLunaLogLine(
  line: string,
  kind: LunaLogFileKind = 'app',
): Promise<void> {
  await invoke('append_luna_log', { line, kind })
}

export async function readLunaAssetIndex(workspaceId: string): Promise<AssetIndexRecord> {
  return invoke<AssetIndexRecord>('read_luna_asset_index', {
    payload: { workspaceId },
  })
}

export async function writeLunaAssetIndex(
  workspaceId: string,
  workspaceRoot: string,
  index: AssetIndexRecord,
): Promise<void> {
  await invoke('write_luna_asset_index', {
    payload: {
      workspaceId,
      workspaceRoot,
      index,
    },
  })
}

export async function scanLunaAssetIndex(workspaceId: string): Promise<AssetIndexRecord> {
  return invoke<AssetIndexRecord>('scan_luna_asset_index', {
    payload: { workspaceId },
  })
}
