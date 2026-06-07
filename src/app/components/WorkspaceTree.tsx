import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { pathSetHas, pathsEqual } from '../../lib/workspacePathUtils'
import { Icon } from '../../design-system/icons'
import type { FlatWorkspaceFile, FsTreeNode } from '../workspace/types'
import {
  WorkspaceFolderDropTarget,
  isWorkspacePathDragging,
  workspaceParentDir,
  type WorkspaceDragTarget,
} from '../workspace/workspaceDrag'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'

export type WorkspaceTreeProps = {
  nodes: FsTreeNode[]
  depth: number
  rootDir: string
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  activePath: string
  isFileSelected?: (path: string) => boolean
  onFileClick?: (e: ReactMouseEvent, path: string) => void
  onFileContextMenu?: (e: ReactMouseEvent, path: string, isDirectory?: boolean) => void
  dragOverTarget?: WorkspaceDragTarget | null
  draggingFilePath?: string[] | string | null
  onDragOverTarget?: (target: WorkspaceDragTarget | null) => void
  onMoveFileToFolder?: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => void
  onFilePointerDown?: (e: ReactPointerEvent, path: string, isDirectory?: boolean) => void
}
export function WorkspaceTree({
  nodes,
  depth,
  rootDir,
  expandedDirs,
  onToggleDir,
  activePath,
  isFileSelected,
  onFileClick,
  onFileContextMenu,
  dragOverTarget,
  draggingFilePath,
  onDragOverTarget,
  onMoveFileToFolder,
  onFilePointerDown,
}: WorkspaceTreeProps) {
  return (
    <>
      {nodes.map((node) =>
        node.kind === 'dir' ? (
          <div key={node.path} className="tree-node">
            <WorkspaceFolderDropTarget
              folderPath={node.path}
              folderName={node.name}
              dragOverTarget={dragOverTarget}
              draggingFilePath={draggingFilePath}
              onDragOverTarget={onDragOverTarget}
              onMoveFileToFolder={onMoveFileToFolder}
              className={`tree-folder${isWorkspacePathDragging(draggingFilePath, node.path) ? ' tree-folder-dragging' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => onToggleDir(node.path)}
            >
              <span
                className="tree-folder-inner"
                onMouseDown={preventButtonSecondaryMouseDown}
                onPointerDown={(e) => {
                  if (!onFilePointerDown || e.button !== 0) return
                  onFilePointerDown(e, node.path, true)
                }}
                onContextMenu={(e) => {
                  if (!onFileContextMenu) return
                  e.preventDefault()
                  e.stopPropagation()
                  onFileContextMenu(e, node.path, true)
                }}
              >
                <span className="tree-chevron" aria-hidden>
                  {pathSetHas(expandedDirs, node.path) ? (
                    <Icon name="chevron-down" size="sm" stroke="strong" />
                  ) : (
                    <Icon name="chevron-right" size="sm" stroke="strong" />
                  )}
                </span>
                <Icon name="workspace" size="md" className="tree-icon" tone="muted" />
                <span className="tree-label">{node.name}</span>
              </span>
            </WorkspaceFolderDropTarget>
            {pathSetHas(expandedDirs, node.path) && node.children.length > 0 ? (
              <div className="tree-node-children">
                <WorkspaceTree
                  nodes={node.children}
                  depth={depth + 1}
                  rootDir={rootDir}
                  expandedDirs={expandedDirs}
                  onToggleDir={onToggleDir}
                  activePath={activePath}
                  isFileSelected={isFileSelected}
                  onFileClick={onFileClick}
                  onFileContextMenu={onFileContextMenu}
                  dragOverTarget={dragOverTarget}
                  draggingFilePath={draggingFilePath}
                  onDragOverTarget={onDragOverTarget}
                  onMoveFileToFolder={onMoveFileToFolder}
                  onFilePointerDown={(e, path, isDirectory) => onFilePointerDown?.(e, path, isDirectory)}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            key={node.path}
            data-workspace-file-path={node.path}
            data-workspace-drop-dir={workspaceParentDir(rootDir, node.path)}
            className={`tree-file note-item ${pathsEqual(activePath, node.path) ? 'active' : ''}${isFileSelected?.(node.path) ? ' is-selected' : ''}${isWorkspacePathDragging(draggingFilePath, node.path) ? ' tree-file-dragging' : ''}${dragOverTarget?.kind === 'file' && pathsEqual(dragOverTarget.anchorPath, node.path) ? ' tree-file-drop-target' : ''}`}
            style={{ paddingLeft: 12 + depth * 14 + 20 }}
            onClick={(e) => onFileClick?.(e, node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onFileClick?.(e as unknown as ReactMouseEvent, node.path)
              }
            }}
            onMouseDown={preventButtonSecondaryMouseDown}
            onPointerDown={(e) => {
              if (!onFilePointerDown || e.button !== 0) return
              onFilePointerDown(e, node.path, false)
            }}
            onContextMenu={(e) => {
              if (!onFileContextMenu) return
              e.preventDefault()
              e.stopPropagation()
              onFileContextMenu(e, node.path, false)
            }}
          >
            <Icon name="note" size="sm" className="tree-icon" tone="muted" />
            <span className="tree-label">{node.name}</span>
          </div>
        ),
      )}
    </>
  )
}
export function WorkspaceFlatList({
  files,
  rootDir,
  activePath,
  isFileSelected,
  onFileClick,
  onFileContextMenu,
  onFilePointerDown,
  draggingFilePath,
  dragOverTarget,
}: {
  files: FlatWorkspaceFile[]
  rootDir: string
  activePath: string
  isFileSelected?: (path: string) => boolean
  onFileClick?: (e: ReactMouseEvent, path: string) => void
  onFileContextMenu?: (e: ReactMouseEvent, path: string, isDirectory?: boolean) => void
  onFilePointerDown?: (e: ReactPointerEvent, path: string, isDirectory?: boolean) => void
  draggingFilePath?: string[] | string | null
  dragOverTarget?: WorkspaceDragTarget | null
}) {
  return (
    <>
      {files.map((f) => (
        <div
          role="button"
          tabIndex={0}
          key={f.path}
          data-workspace-file-path={f.path}
          data-workspace-drop-dir={workspaceParentDir(rootDir, f.path)}
          className={`note-item file-list-flat-item ${pathsEqual(activePath, f.path) ? 'active' : ''}${isFileSelected?.(f.path) ? ' is-selected' : ''}${isWorkspacePathDragging(draggingFilePath, f.path) ? ' tree-file-dragging' : ''}${dragOverTarget?.kind === 'file' && pathsEqual(dragOverTarget.anchorPath, f.path) ? ' tree-file-drop-target' : ''}`}
          onClick={(e) => onFileClick?.(e, f.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onFileClick?.(e as unknown as ReactMouseEvent, f.path)
            }
          }}
          onMouseDown={preventButtonSecondaryMouseDown}
          onPointerDown={(e) => {
            if (!onFilePointerDown || e.button !== 0) return
            onFilePointerDown(e, f.path, false)
          }}
          onContextMenu={(e) => {
            if (!onFileContextMenu) return
            e.preventDefault()
            e.stopPropagation()
            onFileContextMenu(e, f.path, false)
          }}
        >
          <Icon name="note" size="sm" className="tree-icon file-list-flat-icon" tone="muted" />
          <span className="file-list-flat-text">
            <span className="file-list-flat-label">{f.label}</span>
            {f.sublabel ? <span className="file-list-flat-sublabel">{f.sublabel}</span> : null}
          </span>
        </div>
      ))}
    </>
  )
}
