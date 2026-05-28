import { normPath } from '../lib/workspacePathUtils'

export type AssetStorageMode =
  | 'relative_to_document'
  | 'absolute_path'

export type AssetStorageConfig = {
  mode: AssetStorageMode
  absolutePath?: string
  relativeFolderName?: string
}

export const DEFAULT_ASSET_STORAGE_CONFIG: AssetStorageConfig = {
  mode: 'relative_to_document',
  relativeFolderName: '{doc-name}-assets',
  absolutePath: '',
}

export function normalizeAssetStorageConfig(
  config: Partial<AssetStorageConfig> | null | undefined,
): AssetStorageConfig {
  const mode: AssetStorageMode =
    config?.mode === 'absolute_path' ? 'absolute_path' : 'relative_to_document'
  return {
    ...DEFAULT_ASSET_STORAGE_CONFIG,
    ...config,
    mode,
    relativeFolderName: config?.relativeFolderName?.trim() || DEFAULT_ASSET_STORAGE_CONFIG.relativeFolderName,
    absolutePath:
      typeof config?.absolutePath === 'string' && config.absolutePath.trim()
        ? normPath(config.absolutePath.trim())
        : '',
  }
}
