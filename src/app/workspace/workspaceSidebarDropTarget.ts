import { isHiddenAssetFolderName } from '../../lib/workspacePathUtils'
import type { WorkspaceDragTarget } from './workspaceDrag'

/** Resolve sidebar folder/file/root drop target from pointer (workspace reorder + OS import). */
export function resolveWorkspaceSidebarDropTarget(
  clientX: number,
  clientY: number,
  rootDir: string,
): WorkspaceDragTarget | null {
  const normRoot = rootDir.replace(/[/\\]+$/u, '')
  if (!normRoot) return null

  const stack = document.elementsFromPoint(clientX, clientY)
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue
    if (el.classList.contains('tree-file-dragging') || el.classList.contains('tree-folder-dragging')) {
      continue
    }

    const folderEl = el.closest('[data-workspace-folder-path].tree-folder') as HTMLElement | null
    if (folderEl) {
      const path = folderEl.getAttribute('data-workspace-folder-path') ?? ''
      const name = folderEl.getAttribute('data-workspace-folder-name') ?? ''
      if (path && !isHiddenAssetFolderName(name)) {
        return { destDir: path, kind: 'folder', anchorPath: path }
      }
    }

    const fileDropEl = el.closest('[data-workspace-drop-dir]') as HTMLElement | null
    if (fileDropEl) {
      const destDir = fileDropEl.getAttribute('data-workspace-drop-dir') ?? ''
      const anchorPath = fileDropEl.getAttribute('data-workspace-file-path') ?? undefined
      if (destDir) return { destDir, kind: 'file', anchorPath }
    }

    const rootEl = el.closest('[data-workspace-root-drop]') as HTMLElement | null
    if (rootEl && !el.closest('.tree-node')) {
      const destDir = rootEl.getAttribute('data-workspace-root-drop') ?? normRoot
      if (destDir) return { destDir, kind: 'root' }
    }
  }
  return null
}
