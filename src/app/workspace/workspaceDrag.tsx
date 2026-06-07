import type { CSSProperties, ReactNode } from 'react'
import { isHiddenAssetFolderName, isPathInsideDirectory, parentDirectoryOfFile, pathsEqual } from '../../lib/workspacePathUtils'
import type { FsTreeNode } from './types'

export const WORKSPACE_FILE_DRAG_MIME = 'application/x-luna-workspace-file'
export const WORKSPACE_FILE_DRAG_PREFIX = 'luna-ws-file:'
export const WORKSPACE_FILE_DRAG_THRESHOLD_PX = 5

export function decodeWorkspaceFileDrag(raw: string): string | null {
  if (!raw.startsWith(WORKSPACE_FILE_DRAG_PREFIX)) return null
  const path = raw.slice(WORKSPACE_FILE_DRAG_PREFIX.length)
  return path.length > 0 ? path : null
}

export function isWorkspaceFileDragEvent(e: { dataTransfer: DataTransfer | null }): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('text/plain') || Array.from(types).includes(WORKSPACE_FILE_DRAG_MIME)
}

export function readWorkspaceFileDragData(e: { dataTransfer: DataTransfer | null }): string | null {
  const dt = e.dataTransfer
  if (!dt) return null
  const custom = dt.getData(WORKSPACE_FILE_DRAG_MIME)
  if (custom) return custom
  return decodeWorkspaceFileDrag(dt.getData('text/plain'))
}

export function resolveWorkspaceFilePathUnderPointer(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const fileEl = el?.closest('[data-workspace-file-path]') as HTMLElement | null
  return fileEl?.getAttribute('data-workspace-file-path') ?? null
}

export function resolveWorkspacePath(rootDir: string, p: string): string {
  if (/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(p)) return p
  const base = rootDir.replace(/[/\\]+$/u, '')
  const rel = p.replace(/^[/\\]+/u, '')
  return `${base}/${rel}`.replace(/\/+/g, '/')
}

export function collectFolderNodes(nodes: FsTreeNode[]): FsTreeNode[] {
  const out: FsTreeNode[] = []
  for (const n of nodes) {
    if (n.kind === 'dir' && !isHiddenAssetFolderName(n.name)) {
      out.push(n)
      out.push(...collectFolderNodes(n.children))
    }
  }
  return out
}

export function workspaceParentDir(rootDir: string, filePath: string): string {
  const parent = parentDirectoryOfFile(filePath)
  if (!parent) return rootDir.replace(/[/\\]+$/u, '')
  return parent
}

export function isValidMoveDest(sourcePath: string, destDir: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/u, '')
  const destName = destDir.replace(/\\/g, '/').split('/').pop() ?? ''
  if (isHiddenAssetFolderName(destName)) return false
  const sourceNorm = norm(sourcePath)
  const destNorm = norm(destDir)
  if (pathsEqual(sourceNorm, destNorm)) return false
  if (isPathInsideDirectory(destNorm, sourcePath)) return false
  return norm(parentDirectoryOfFile(sourcePath)) !== destNorm
}

export function isValidBulkMoveDest(sourcePaths: string[], destDir: string): boolean {
  if (sourcePaths.length === 0) return false
  return sourcePaths.every((p) => isValidMoveDest(p, destDir))
}

export function normalizeDraggingPaths(dragging: string[] | string | null | undefined): string[] {
  if (!dragging) return []
  return Array.isArray(dragging) ? dragging : [dragging]
}

export function isWorkspacePathDragging(
  dragging: string[] | string | null | undefined,
  path: string,
): boolean {
  return normalizeDraggingPaths(dragging).some((p) => pathsEqual(p, path))
}

export type WorkspaceDragTarget = {
  destDir: string
  kind: 'folder' | 'file' | 'root'
  anchorPath?: string
}

export type WorkspaceFolderDropProps = {
  folderPath: string
  folderName: string
  dragOverTarget?: WorkspaceDragTarget | null
  draggingFilePath?: string[] | string | null
  onDragOverTarget?: (target: WorkspaceDragTarget | null) => void
  onMoveFileToFolder?: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => void
  className?: string
  style?: CSSProperties
  children: ReactNode
  onClick?: () => void
}

export function WorkspaceFolderDropTarget({
  folderPath,
  folderName,
  dragOverTarget,
  draggingFilePath,
  onDragOverTarget,
  onMoveFileToFolder,
  className,
  style,
  children,
  onClick,
}: WorkspaceFolderDropProps) {
  const isAssets = isHiddenAssetFolderName(folderName)
  const isDropTarget = dragOverTarget?.kind === 'folder' && pathsEqual(dragOverTarget.anchorPath, folderPath)
  const canAcceptWorkspaceDrag = (e?: { dataTransfer: DataTransfer | null }) =>
    normalizeDraggingPaths(draggingFilePath).length > 0 || (e ? isWorkspaceFileDragEvent(e) : false)
  const emitFolderTarget = () => {
    onDragOverTarget?.({ destDir: folderPath, kind: 'folder', anchorPath: folderPath })
  }
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-workspace-folder-path={isAssets ? undefined : folderPath}
      data-workspace-folder-name={isAssets ? undefined : folderName}
      className={`${className ?? ''}${isDropTarget ? ' tree-folder-drop-target' : ''}`.trim()}
      style={style}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      onDragOver={(e) => {
        if (!onMoveFileToFolder || isAssets) return
        if (!canAcceptWorkspaceDrag(e)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        emitFolderTarget()
      }}
      onDragEnter={(e) => {
        if (!onMoveFileToFolder || isAssets) return
        if (!canAcceptWorkspaceDrag(e)) return
        e.preventDefault()
        e.stopPropagation()
        emitFolderTarget()
      }}
      onDragLeave={(e) => {
        if (!onDragOverTarget) return
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        if (dragOverTarget?.kind === 'folder' && pathsEqual(dragOverTarget.anchorPath, folderPath)) onDragOverTarget(null)
      }}
      onDrop={(e) => {
        if (!onMoveFileToFolder || isAssets) return
        e.preventDefault()
        e.stopPropagation()
        onDragOverTarget?.(null)
        const dragging = normalizeDraggingPaths(draggingFilePath)
        const filePath = dragging[0] ?? readWorkspaceFileDragData(e)
        if (!filePath || !isValidMoveDest(filePath, folderPath)) return
        onMoveFileToFolder(dragging.length > 1 ? dragging : filePath, folderPath)
      }}
    >
      {children}
    </div>
  )
}
