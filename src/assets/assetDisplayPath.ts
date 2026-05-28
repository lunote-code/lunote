import type { AssetStorageConfig } from './assetStoragePolicy'
import { normPath, parentDirectoryOfFile, pathsEqual, relativePathUnderRoot } from '../lib/workspacePathUtils'
import type { AssetMeta } from './workspaceAssetStore'

export type AssetDisplayPathContext = {
  documentPath?: string
  workspaceRoot?: string
  storageConfig?: AssetStorageConfig
}

/** Display path (not disk absolute path) for hover tooltip under User Preferences*/
export function formatAssetDisplayPath(
  asset: AssetMeta,
  ctx?: AssetDisplayPathContext,
): string {
  const diskPath = normPath(asset.resolvedPath || asset.absolutePath)
  const mode = ctx?.storageConfig?.mode ?? asset.storageMode ?? 'relative_to_document'

  if (mode === 'absolute_path') {
    const root = ctx?.storageConfig?.absolutePath?.trim()
    if (root) {
      const rootNorm = normPath(root)
      const diskNorm = normPath(diskPath)
      if (diskNorm === rootNorm || diskNorm.startsWith(`${rootNorm}/`)) {
        const rel = diskNorm.slice(rootNorm.length).replace(/^\//u, '')
        return rel || fileBaseName(diskPath)
      }
    }
    return fileBaseName(diskPath)
  }

  const docPath = ctx?.documentPath?.trim()
  const wsRoot = ctx?.workspaceRoot?.trim()
  if (docPath && wsRoot) {
    const docNorm = normPath(docPath)
    const docParent = parentDirectoryOfFile(docNorm)
    const diskNorm = normPath(diskPath)
    if (docParent && (diskNorm === docParent || diskNorm.startsWith(`${docParent}/`))) {
      return `./${diskNorm.slice(docParent.length + 1).replace(/^\//u, '')}`
    }
    const relFromWs = relativePathUnderRoot(wsRoot, diskPath)
    if (relFromWs) return relFromWs
  }

  return fileBaseName(diskPath)
}

/** Relative path to write the index (relative to the workspace or relative to the notes directory)*/
export function computeAssetIndexRelativePath(
  targetDir: string,
  fileName: string,
  documentPath: string,
  storageConfig: AssetStorageConfig,
  workspaceRoot: string,
): string {
  const fullPath = normPath(`${normPath(targetDir)}/${fileName}`)
  if (storageConfig.mode === 'absolute_path') {
    const root = storageConfig.absolutePath?.trim()
    if (root) {
      const rootNorm = normPath(root)
      if (fullPath === rootNorm || fullPath.startsWith(`${rootNorm}/`)) {
        return fullPath.slice(rootNorm.length).replace(/^\//u, '')
      }
    }
    return fileName
  }

  const relFromWs = relativePathUnderRoot(workspaceRoot, fullPath)
  if (relFromWs) return relFromWs

  const docParent = parentDirectoryOfFile(normPath(documentPath))
  if (docParent && (pathsEqual(fullPath, docParent) || fullPath.startsWith(`${docParent}/`))) {
    return fullPath.slice(docParent.length + 1).replace(/^\//u, '')
  }

  return fileName
}

export function enrichAssetMetaPaths(
  asset: AssetMeta,
  ctx: {
    targetDir: string
    fileName: string
    documentPath: string
    workspaceRoot: string
    storageConfig: AssetStorageConfig
  },
): AssetMeta {
  const relativePath = computeAssetIndexRelativePath(
    ctx.targetDir,
    ctx.fileName,
    ctx.documentPath,
    ctx.storageConfig,
    ctx.workspaceRoot,
  )
  return {
    ...asset,
    relativePath,
    storageMode: ctx.storageConfig.mode,
  }
}

function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}
