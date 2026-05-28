import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { pathSetHas, pathsEqual } from '../../lib/workspacePathUtils'
import { Icon } from '../../design-system/icons'
import type { FlatWorkspaceFile, FsTreeNode } from '../workspace/types'
import { WorkspaceFolderDropTarget, workspaceParentDir, type WorkspaceDragTarget } from '../workspace/workspaceDrag'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'

export type WorkspaceTreeProps = {
  nodes: FsTreeNode[]
  depth: number
  rootDir: string
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  activePath: string
  onOpenFile: (path: string) => void
  onFileContextMenu?: (e: ReactMouseEvent, path: string, isDirectory?: boolean) => void
  dragOverTarget?: WorkspaceDragTarget | null
  draggingFilePath?: string | null
  onDragOverTarget?: (target: WorkspaceDragTarget | null) => void
  onMoveFileToFolder?: (filePath: string, destDir: string) => void
  onFilePointerDown?: (e: ReactPointerEvent, path: string) => void
}
export function WorkspaceTree({
  nodes,
  depth,
  rootDir,
  expandedDirs,
  onToggleDir,
  activePath,
  onOpenFile,
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
              className="tree-folder"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => onToggleDir(node.path)}
            >
              <span
                className="tree-folder-inner"
                onMouseDown={preventButtonSecondaryMouseDown}
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
                  onOpenFile={onOpenFile}
                  onFileContextMenu={onFileContextMenu}
                  dragOverTarget={dragOverTarget}
                  draggingFilePath={draggingFilePath}
                  onDragOverTarget={onDragOverTarget}
                  onMoveFileToFolder={onMoveFileToFolder}
                  onFilePointerDown={onFilePointerDown}
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
            className={`tree-file note-item ${pathsEqual(activePath, node.path) ? 'active' : ''}${pathsEqual(draggingFilePath, node.path) ? ' tree-file-dragging' : ''}${dragOverTarget?.kind === 'file' && pathsEqual(dragOverTarget.anchorPath, node.path) ? ' tree-file-drop-target' : ''}`}
            style={{ paddingLeft: 12 + depth * 14 + 20 }}
            onClick={() => onOpenFile(node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenFile(node.path)
              }
            }}
            onMouseDown={preventButtonSecondaryMouseDown}
            onPointerDown={(e) => {
              if (!onFilePointerDown || e.button !== 0) return
              onFilePointerDown(e, node.path)
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
  onOpenFile,
  onFileContextMenu,
  onFilePointerDown,
  draggingFilePath,
  dragOverTarget,
}: {
  files: FlatWorkspaceFile[]
  rootDir: string
  activePath: string
  onOpenFile: (path: string) => void
  onFileContextMenu?: (e: ReactMouseEvent, path: string, isDirectory?: boolean) => void
  onFilePointerDown?: (e: ReactPointerEvent, path: string) => void
  draggingFilePath?: string | null
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
          className={`note-item file-list-flat-item ${pathsEqual(activePath, f.path) ? 'active' : ''}${pathsEqual(draggingFilePath, f.path) ? ' tree-file-dragging' : ''}${dragOverTarget?.kind === 'file' && pathsEqual(dragOverTarget.anchorPath, f.path) ? ' tree-file-drop-target' : ''}`}
          onClick={() => onOpenFile(f.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenFile(f.path)
            }
          }}
          onMouseDown={preventButtonSecondaryMouseDown}
          onPointerDown={(e) => {
            if (!onFilePointerDown || e.button !== 0) return
            onFilePointerDown(e, f.path)
          }}
          onContextMenu={(e) => {
            if (!onFileContextMenu) return
            e.preventDefault()
            e.stopPropagation()
            onFileContextMenu(e, f.path, false)
          }}
        >
          <span className="file-list-flat-row">
            <Icon name="note" size="sm" className="tree-icon" tone="muted" />
            <span className="file-list-flat-text">
              <span className="file-list-flat-label">{f.label}</span>
              {f.sublabel ? <span className="file-list-flat-sublabel">{f.sublabel}</span> : null}
            </span>
          </span>
        </div>
      ))}
    </>
  )
}
