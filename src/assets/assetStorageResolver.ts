import type { AssetStorageMode } from './assetStoragePolicy'
import { DEFAULT_ASSET_STORAGE_CONFIG } from './assetStoragePolicy'
import { pathHasParentDirSegment, normPath } from '../lib/workspacePathUtils'

export type ResolveAssetStoragePathParams = {
  mode: AssetStorageMode
  documentPath: string
  absolutePath?: string
  relativeFolderName?: string
}

/** Directory path normalization consistent with preferences, Tauri write validation*/
export function normalizeStorageDirectoryPath(path: string): string {
  return normPath(path)
}

export function resolveAssetStoragePath(params: ResolveAssetStoragePathParams): string {
  if (params.mode === 'absolute_path') {
    const absolutePath = params.absolutePath?.trim()
    if (!absolutePath) {
      throw new Error('Absolute asset storage path is required')
    }
    if (pathHasParentDirSegment(absolutePath)) {
      throw new Error('Absolute asset storage path cannot contain ..')
    }
    return normalizeStorageDirectoryPath(absolutePath)
  }

  const docDir = dirname(params.documentPath)
  const docName = stripExt(basename(params.documentPath))
  const template = params.relativeFolderName?.trim() || DEFAULT_ASSET_STORAGE_CONFIG.relativeFolderName!
  const folderName = template.replace(/\{doc-name\}/gu, docName)
  if (pathHasParentDirSegment(folderName)) {
    throw new Error('Asset folder name cannot contain ..')
  }
  return joinPath(docDir, folderName)
}

function normalizeSeparators(path: string): string {
  return normPath(path)
}

function dirname(path: string): string {
  const normalized = normalizeSeparators(path)
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(0, idx) : ''
}

function basename(path: string): string {
  const normalized = normalizeSeparators(path)
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

function stripExt(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx > 0 ? fileName.slice(0, idx) : fileName
}

function joinPath(parent: string, child: string): string {
  const cleanChild = child.replace(/^\/+/u, '').replace(/\/+$/u, '')
  if (!parent) return cleanChild
  return `${normalizeSeparators(parent)}/${cleanChild}`
}
