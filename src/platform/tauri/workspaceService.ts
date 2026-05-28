import { invoke } from '@tauri-apps/api/core'

import type { FsTreeNode } from '../../app/workspace/types'

export async function listWorkspaceTree(root: string): Promise<FsTreeNode[]> {
  return invoke<FsTreeNode[]>('list_workspace_tree', { payload: { root } })
}

export async function indexWorkspaceNotes(root: string): Promise<number> {
  const result = await invoke<{ count: number }>('index_notes', { payload: { root } })
  return result.count
}

export async function watchWorkspace(root: string): Promise<void> {
  await invoke('watch_workspace', { payload: { root } })
}

export async function unwatchWorkspace(root: string): Promise<void> {
  await invoke('unwatch_workspace', { payload: { root } })
}

export async function createWorkspaceFolder(root: string, parentPath: string, name: string): Promise<string> {
  return invoke<string>('create_workspace_folder', { payload: { root, parentPath, name } })
}

export async function importMarkdownViaDialog(root: string): Promise<string | null> {
  return invoke<string | null>('import_markdown_via_dialog', { root })
}
