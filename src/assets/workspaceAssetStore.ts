import {
  readLunaAssetIndex,
  scanLunaAssetIndex,
  writeLunaAssetIndex,
} from '../platform/tauri/persistenceService'

export type AssetMeta = {
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

export type AssetIndex = {
  assets: Record<string, AssetMeta>
}

let activeWorkspaceId: string | null = null
let activeWorkspaceRoot: string | null = null
const indexes = new Map<string, AssetIndex>()

export function setActiveAssetWorkspace(workspaceId: string | null, workspaceRoot: string | null = null): void {
  activeWorkspaceId = workspaceId
  activeWorkspaceRoot = workspaceRoot
}

export function getActiveAssetWorkspaceRoot(): string {
  if (!activeWorkspaceRoot) {
    throw new Error('No active workspace root for Luna assets')
  }
  return activeWorkspaceRoot
}

export function getActiveAssetWorkspace(): string {
  if (!activeWorkspaceId) {
    throw new Error('No active workspace for Luna assets')
  }
  return activeWorkspaceId
}

export async function readWorkspaceAssetIndex(workspaceId = getActiveAssetWorkspace()): Promise<AssetIndex> {
  const index = await readLunaAssetIndex(workspaceId)
  indexes.set(workspaceId, normalizeAssetIndex(index))
  return indexes.get(workspaceId)!
}

export async function writeWorkspaceAssetIndex(
  index: AssetIndex,
  workspaceId = getActiveAssetWorkspace(),
): Promise<void> {
  const normalized = normalizeAssetIndex(index)
  indexes.set(workspaceId, normalized)
  await writeLunaAssetIndex(workspaceId, getActiveAssetWorkspaceRoot(), normalized)
}

export async function addAssetMeta(asset: AssetMeta): Promise<void> {
  const workspaceId = getActiveAssetWorkspace()
  const current = indexes.get(workspaceId) ?? await readWorkspaceAssetIndex(workspaceId)
  const next: AssetIndex = {
    assets: {
      ...current.assets,
      [asset.id]: normalizeAssetMeta(asset),
    },
  }
  await writeWorkspaceAssetIndex(next, workspaceId)
}

export function getCachedAssetIndex(workspaceId = activeWorkspaceId): AssetIndex | null {
  if (!workspaceId) return null
  return indexes.get(workspaceId) ?? null
}

export async function listAssetMetas(workspaceId = getActiveAssetWorkspace()): Promise<AssetMeta[]> {
  const cached = indexes.get(workspaceId)
  const index = cached ?? await readWorkspaceAssetIndex(workspaceId)
  return Object.values(index.assets)
}

export async function updateAssetReferenceStats(
  stats: Record<string, { referenceCount: number; lastReferencedAt?: number }>,
  workspaceId = getActiveAssetWorkspace(),
): Promise<void> {
  const current = indexes.get(workspaceId) ?? await readWorkspaceAssetIndex(workspaceId)
  let changed = false
  const assets: Record<string, AssetMeta> = {}
  for (const [id, asset] of Object.entries(current.assets)) {
    const stat = stats[id] ?? { referenceCount: 0, lastReferencedAt: undefined }
    const next = normalizeAssetMeta({
      ...asset,
      referenceCount: stat.referenceCount,
      lastReferencedAt: stat.lastReferencedAt,
    })
    assets[id] = next
    changed =
      changed ||
      asset.referenceCount !== next.referenceCount ||
      asset.lastReferencedAt !== next.lastReferencedAt
  }
  if (changed) {
    await writeWorkspaceAssetIndex({ assets }, workspaceId)
  }
}

export async function getAssetMeta(assetId: string): Promise<AssetMeta | null> {
  const workspaceId = getActiveAssetWorkspace()
  const cached = indexes.get(workspaceId)
  const index = cached ?? await readWorkspaceAssetIndex(workspaceId)
  return index.assets[assetId] ?? null
}

export function getCachedAssetMeta(assetId: string, workspaceId = activeWorkspaceId): AssetMeta | null {
  if (!workspaceId) return null
  return indexes.get(workspaceId)?.assets[assetId] ?? null
}

export async function scanWorkspaceAssets(workspaceId = getActiveAssetWorkspace()): Promise<AssetIndex> {
  const index = await scanLunaAssetIndex(workspaceId)
  indexes.set(workspaceId, normalizeAssetIndex(index))
  return indexes.get(workspaceId)!
}

function normalizeAssetIndex(index: AssetIndex | null | undefined): AssetIndex {
  const assets: Record<string, AssetMeta> = {}
  for (const [id, asset] of Object.entries(index?.assets ?? {})) {
    assets[id] = normalizeAssetMeta(asset)
  }
  return {
    assets,
  }
}

function normalizeAssetMeta(asset: AssetMeta): AssetMeta {
  return {
    ...asset,
    resolvedPath: asset.resolvedPath || asset.absolutePath,
    storageMode: asset.storageMode,
    referenceCount: asset.referenceCount ?? 0,
  }
}
