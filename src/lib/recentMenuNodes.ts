import type { MenuNode } from '../menu/menu.types'
import {
  filterRecentFilesForDisplay,
  isValidRecentWorkspacePath,
} from './workspacePathUtils'

export type RecentMenuSlice = {
  workspaces: string[]
  files: string[]
}

export function sliceRecentMenuItems(
  recentWorkspaces: readonly string[],
  recentFiles: readonly string[],
  limit = 8,
): RecentMenuSlice {
  const workspaces = recentWorkspaces.filter(isValidRecentWorkspacePath).slice(0, limit)
  const files = filterRecentFilesForDisplay(recentFiles, workspaces).slice(0, limit)
  return { workspaces, files }
}

export function buildRecentMenuChildren(
  recentWorkspaces: readonly string[],
  recentFiles: readonly string[],
  limit = 8,
): MenuNode[] {
  const { workspaces, files } = sliceRecentMenuItems(recentWorkspaces, recentFiles, limit)
  const nodes: MenuNode[] = []

  for (let i = 0; i < workspaces.length; i++) {
    const path = workspaces[i]!
    nodes.push({
      kind: 'item',
      id: `recent-ws-${i}`,
      labelKey: 'menu.file.recent',
      action: `recent-workspace:${path}`,
      semanticIcon: 'workspace-open',
    })
  }

  if (workspaces.length > 0 && files.length > 0) {
    nodes.push({ kind: 'separator' })
  }

  for (let i = 0; i < files.length; i++) {
    const path = files[i]!
    nodes.push({
      kind: 'item',
      id: `recent-file-${i}`,
      labelKey: 'menu.file.recent',
      action: `recent:${path}`,
      semanticIcon: 'note',
    })
  }

  if (nodes.length > 0) {
    nodes.push({ kind: 'separator' })
  }

  nodes.push({
    kind: 'item',
    id: 'file-clear-recent',
    labelKey: 'menu.file.clearRecent',
    action: 'file-clear-recent',
    semanticIcon: 'delete',
  })

  return nodes
}

export function hasRecentMenuItems(recentWorkspaces: readonly string[], recentFiles: readonly string[]): boolean {
  const { workspaces, files } = sliceRecentMenuItems(recentWorkspaces, recentFiles, 1)
  return workspaces.length > 0 || files.length > 0
}
