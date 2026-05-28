import { invoke } from '@tauri-apps/api/core'
import { getDocumentsByAsset } from './assetGraph'
import {
  getActiveAssetWorkspace,
  getActiveAssetWorkspaceRoot,
  listAssetMetas,
} from './workspaceAssetStore'

export type OrphanAsset = {
  assetId: string
  reason: 'no_reference' | 'missing_file'
}

export async function detectOrphanAssets(
  workspaceId = getActiveAssetWorkspace(),
): Promise<OrphanAsset[]> {
  const assets = await listAssetMetas(workspaceId)
  const orphans: OrphanAsset[] = []
  await Promise.all(assets.map(async (asset) => {
    const refs = getDocumentsByAsset(asset.id)
    if (refs.length === 0) {
      orphans.push({ assetId: asset.id, reason: 'no_reference' })
    }
    const exists = await invoke<boolean>('path_exists', {
      payload: {
        path: asset.resolvedPath || asset.absolutePath,
        workspaceRoot: getActiveAssetWorkspaceRoot(),
      },
    })
    if (!exists) {
      orphans.push({ assetId: asset.id, reason: 'missing_file' })
    }
  }))
  return orphans
}
