import { addAssetMeta, getActiveAssetWorkspace, type AssetMeta } from './workspaceAssetStore'
import type { AssetStorageConfig } from './assetStoragePolicy'
import { normalizeAssetStorageConfig } from './assetStoragePolicy'
import { enrichAssetMetaPaths } from './assetDisplayPath'
import { resolveAssetStoragePath } from './assetStorageResolver'
import { isPathUnderWorkspace, pathHasParentDirSegment } from '../lib/workspacePathUtils'
import { saveLunaAssetFile } from '../platform/tauri/assetService'
import { openTrustedPath, revealInExplorer } from '../platform/tauri/platformShellService'

type SaveAssetResponse = AssetMeta

export type ImportAssetContext = {
  documentPath: string
  workspaceRoot: string
  workspaceId?: string
  storageConfig: AssetStorageConfig
}

export async function importAsset(file: File, context: ImportAssetContext): Promise<AssetMeta> {
  const workspaceId = context.workspaceId ?? getActiveAssetWorkspace()
  const assetId = createAssetId(file)
  const storageConfig = normalizeAssetStorageConfig(context.storageConfig)
  const targetDir = resolveAssetStoragePath({
    mode: storageConfig.mode,
    documentPath: context.documentPath,
    absolutePath: storageConfig.absolutePath,
    relativeFolderName: storageConfig.relativeFolderName,
  })
  if (pathHasParentDirSegment(targetDir)) {
    throw new Error('Asset directory path cannot contain ..')
  }
  if (storageConfig.mode === 'relative_to_document') {
    if (!isPathUnderWorkspace(context.workspaceRoot, targetDir)) {
      throw new Error('Asset directory must be inside the workspace')
    }
  }
  const dataBase64 = await fileToBase64(file)
  const saved = await saveLunaAssetFile<SaveAssetResponse>({
    workspaceId,
    assetId,
    originalName: file.name || 'asset.bin',
    mimeType: file.type || 'application/octet-stream',
    targetDir,
    storageMode: storageConfig.mode,
    workspaceRoot: context.workspaceRoot,
    dataBase64,
  })
  const diskName =
    saved.absolutePath.replace(/\\/g, '/').split('/').pop() ??
    saved.originalName
  const asset = enrichAssetMetaPaths(saved, {
    targetDir,
    fileName: diskName,
    documentPath: context.documentPath,
    workspaceRoot: context.workspaceRoot,
    storageConfig,
  })
  await addAssetMeta(asset)
  return asset
}

export async function revealAssetInFolder(asset: AssetMeta, workspaceRoot: string): Promise<void> {
  await revealInExplorer(asset.resolvedPath || asset.absolutePath, workspaceRoot)
}

export async function openAssetFile(asset: AssetMeta, workspaceRoot: string): Promise<void> {
  await openTrustedPath(asset.resolvedPath || asset.absolutePath, workspaceRoot)
}

export function previewAsset(asset: AssetMeta): void {
  console.info('[LUNA ASSET PREVIEW]', {
    id: asset.id,
    name: asset.originalName,
    path: asset.resolvedPath || asset.absolutePath,
    mimeType: asset.mimeType,
  })
}

function createAssetId(file: File): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  const stem = (file.name || 'asset')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-zA-Z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48) || 'asset'
  return `${Date.now().toString(36)}-${suffix}-${stem}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}
