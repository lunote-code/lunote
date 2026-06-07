import { invoke } from '@tauri-apps/api/core'

import { resolveWorkspaceFilePath } from '../../lib/workspacePathUtils'

export async function pathExists(workspaceRoot: string, path: string): Promise<boolean> {
  const resolved = resolveWorkspaceFilePath(workspaceRoot, path)
  return invoke<boolean>('path_exists', {
    payload: { path: resolved, workspaceRoot },
  })
}
