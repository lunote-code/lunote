import { type CSSProperties, type Dispatch, type MouseEvent, type SetStateAction, useEffect, useState } from 'react'
import { Icon } from '../../design-system/icons'
import { DocumentOutlineBlock } from './DocumentOutlineBlock'
import { SidebarRecentFiles } from './SidebarRecentFiles'
import {
  SidebarFileViewToggleButton,
  SidebarListModeSegmented,
} from './SidebarHeaderChrome'
import { SidebarHeaderSearchBar, SidebarSearchToggleButton } from './SidebarSearchChrome'
import { SidebarWorkspaceEmpty } from './SidebarWorkspaceEmpty'
import { SidebarWorkspaceOnboarding } from './SidebarWorkspaceOnboarding'
import { SidebarWorkspaceMenu } from './SidebarWorkspaceMenu'
import { WorkspaceFlatList, WorkspaceTree } from './WorkspaceTree'
import { WorkspaceFolderDropTarget, isWorkspacePathDragging } from '../workspace/workspaceDrag'
import { resolveWorkspaceFolderChrome } from '../workspace/workspaceTree'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode } from '../workspace/types'
import type { WorkspaceDragTarget } from '../workspace/workspaceDrag'
import type { TocHeading } from './DocumentOutlineBlock'

import type { TranslateFn } from '../../i18n'

export type AppSidebarPanelProps = {
  t: TranslateFn
  rootDir: string
  activePath: string
  searchText: string
  setSearchText: Dispatch<SetStateAction<string>>
  isSidebarFiltering: boolean
  sidebarFilterMatchCount: number
  sidebarListMode: 'files' | 'outline'
  draggingWorkspaceFile: string[] | null
  dragOverTarget: WorkspaceDragTarget | null
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  onSidebarBlankContextMenu: (e: MouseEvent) => void
  dispatchOpenDocument: (root: string, path: string, reason?: string) => void | Promise<void>
  onSidebarFileContextMenu: (e: MouseEvent, path: string) => void
  outlineHeadings: TocHeading[]
  activeOutlineId: string | null
  scrollPreviewToHeading: (id: string) => void
  fileTree: FsTreeNode[]
  sidebarFileView: 'tree' | 'list'
  setSidebarFileView: Dispatch<SetStateAction<'tree' | 'list'>>
  workspaceFolderNodes: FsTreeNode[]
  sortedFlatWorkspaceFiles: FlatWorkspaceFile[]
  sortedFileTree: FsTreeNode[]
  expandedDirs: Set<string>
  toggleWorkspaceDir: (path: string) => void
  isFilePathSelected: (path: string) => boolean
  onWorkspaceFileClick: (e: MouseEvent, path: string) => void
  onWorkspaceFilePointerDown: (e: React.PointerEvent, path: string, isDirectory?: boolean) => void
  handleMoveFileToFolder: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => void | Promise<void>
  createNewNote: () => void | Promise<void>
  createNewNoteFromTemplate: () => void | Promise<void>
  workspaceFolderName: string
  workspaceMenuRef: React.RefObject<HTMLDivElement | null>
  workspaceMenuPopRef: React.RefObject<HTMLDivElement | null>
  workspaceMenuOpen: boolean
  setWorkspaceMenuOpen: Dispatch<SetStateAction<boolean>>
  workspaceMenuPopStyle: CSSProperties | null
  fileSortMode: FileSortMode
  setFileSortMode: Dispatch<SetStateAction<FileSortMode>>
  setSidebarListMode: Dispatch<SetStateAction<'files' | 'outline'>>
  setStatus: (msg: string) => void
  chooseFolder: () => void | Promise<void>
  refreshFileTree: () => void | Promise<void>
  recentFiles: readonly string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void | Promise<void>
  /** Sidebar accessibility status line (sr-only alongside search box)*/
  sidebarStatusLine: string
  /** Path highlighted while its file context menu is open. */
  contextMenuFilePath?: string | null
}

export function AppSidebarPanel(props: AppSidebarPanelProps) {
  const {
    t,
    rootDir,
    activePath,
    searchText,
    setSearchText,
    isSidebarFiltering,
    sidebarFilterMatchCount,
    sidebarListMode,
    draggingWorkspaceFile,
    dragOverTarget,
    setDragOverTarget,
    onSidebarBlankContextMenu,
    onSidebarFileContextMenu,
    outlineHeadings,
    activeOutlineId,
    scrollPreviewToHeading,
    fileTree,
    sidebarFileView,
    setSidebarFileView,
    workspaceFolderNodes,
    sortedFlatWorkspaceFiles,
    sortedFileTree,
    expandedDirs,
    toggleWorkspaceDir,
    isFilePathSelected,
    onWorkspaceFileClick,
    onWorkspaceFilePointerDown,
    handleMoveFileToFolder,
    createNewNote,
    createNewNoteFromTemplate,
    workspaceFolderName,
    workspaceMenuRef,
    workspaceMenuPopRef,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    workspaceMenuPopStyle,
    fileSortMode,
    setFileSortMode,
    setSidebarListMode,
    setStatus,
    chooseFolder,
    refreshFileTree,
    recentFiles,
    onOpenRecent,
    onClearRecent,
    sidebarStatusLine,
    contextMenuFilePath = null,
  } = props

  const showOutlinePanel = sidebarListMode === 'outline' && !isSidebarFiltering && activePath
  const filterHasNoMatches =
    isSidebarFiltering &&
    sortedFileTree.length === 0 &&
    sortedFlatWorkspaceFiles.length === 0
  const fileViewToggleDisabled = !rootDir || fileTree.length === 0 || sidebarListMode === 'outline'
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false)

  useEffect(() => {
    if (searchText.trim()) setSidebarSearchOpen(true)
  }, [searchText])

  const closeSidebarSearch = () => {
    setSearchText('')
    setSidebarSearchOpen(false)
  }

  const toggleSidebarSearch = () => {
    if (!rootDir.trim()) {
      setStatus(t('app.menu.openWorkspaceFirst'))
      return
    }
    if (sidebarSearchOpen) {
      closeSidebarSearch()
      return
    }
    setSidebarSearchOpen(true)
  }

  return (
        <aside className="sidebar workspace-split mod-left-split" data-workspace-sidebar>
          <div className="sidebar-pane-top">
            <div className={`sidebar-header${sidebarSearchOpen ? ' sidebar-header--search' : ''}`}>
              {sidebarSearchOpen ? (
                <SidebarHeaderSearchBar
                  t={t}
                  rootDir={rootDir}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onRequestClose={() => setSidebarSearchOpen(false)}
                />
              ) : (
                <>
                  <div className="sidebar-header-primary">
                    <SidebarListModeSegmented
                      t={t}
                      mode={sidebarListMode}
                      onSelectFiles={() => setSidebarListMode('files')}
                      onSelectOutline={() => setSidebarListMode('outline')}
                    />
                    <SidebarFileViewToggleButton
                      t={t}
                      sidebarFileView={sidebarFileView}
                      disabled={fileViewToggleDisabled}
                      onToggle={() => setSidebarFileView((v) => (v === 'tree' ? 'list' : 'tree'))}
                    />
                  </div>
                  <div className="sidebar-header-actions">
                    <SidebarSearchToggleButton
                      t={t}
                      rootDir={rootDir}
                      open={sidebarSearchOpen}
                      isFiltering={isSidebarFiltering}
                      onToggle={toggleSidebarSearch}
                    />
                    <SidebarWorkspaceMenu
                      t={t}
                      rootDir={rootDir}
                      workspaceFolderName={workspaceFolderName}
                      workspaceMenuRef={workspaceMenuRef}
                      workspaceMenuPopRef={workspaceMenuPopRef}
                      workspaceMenuOpen={workspaceMenuOpen}
                      setWorkspaceMenuOpen={setWorkspaceMenuOpen}
                      workspaceMenuPopStyle={workspaceMenuPopStyle}
                      fileSortMode={fileSortMode}
                      setFileSortMode={setFileSortMode}
                      createNewNote={createNewNote}
                      createNewNoteFromTemplate={createNewNoteFromTemplate}
                      chooseFolder={chooseFolder}
                      refreshFileTree={refreshFileTree}
                      setStatus={setStatus}
                    />
                  </div>
                </>
              )}
            </div>
            <span className="sr-only" aria-live="polite">
              {sidebarStatusLine}
            </span>
          </div>
          <div className="sidebar-scroll">
            {isSidebarFiltering && sidebarFilterMatchCount > 0 ? (
              <p className="sidebar-filter-status" role="status">
                {t('app.sidebar.search.filterCount', { count: sidebarFilterMatchCount })}
              </p>
            ) : null}
            <div
              className={`file-list${
                showOutlinePanel ? ' file-list--outline-root' : ''
              }${draggingWorkspaceFile ? ' file-list--workspace-drag' : ''}${dragOverTarget?.kind === 'root' ? ' file-list--root-drop-target' : ''}`}
              data-workspace-root-drop={rootDir ? rootDir.replace(/[/\\]+$/u, '') : undefined}
              onContextMenu={onSidebarBlankContextMenu}
            >
              {!rootDir ? (
                <div className="sidebar-empty-stack">
                  <SidebarWorkspaceEmpty
                    t={t}
                    onOpenFolder={chooseFolder}
                    onScratchNote={createNewNote}
                  />
                  <SidebarWorkspaceOnboarding t={t} />
                  <SidebarRecentFiles
                    t={t}
                    recentFiles={recentFiles}
                    onOpenRecent={onOpenRecent}
                    onClearRecent={onClearRecent}
                  />
                </div>
              ) : filterHasNoMatches ? (
                <p className="file-list-empty">{t('app.sidebar.search.filterEmpty')}</p>
              ) : showOutlinePanel ? (
                <div className="sidebar-list-outline-panel">
                  <div className="sidebar-outline-header">{t('app.sidebar.outlineHeader')}</div>
                  <div
                    className="sidebar-outline-scroll"
                    onMouseDown={(e) => {
                      const target = e.target
                      if (target instanceof Element && target.closest('.document-outline-link, .document-outline-chevron')) {
                        return
                      }
                      e.preventDefault()
                    }}
                  >
                    <DocumentOutlineBlock
                      documentPath={activePath}
                      headings={outlineHeadings}
                      activeId={activeOutlineId ?? ''}
                      onJump={scrollPreviewToHeading}
                    />
                  </div>
                </div>
              ) : sidebarListMode === 'outline' && !activePath ? (
                <p className="file-list-empty">{t('app.sidebar.empty.openNoteOutline')}</p>
              ) : fileTree.length === 0 ? (
                <p className="file-list-empty">{t('app.sidebar.empty.dirEmpty')}</p>
              ) : (
                <>
                  {draggingWorkspaceFile && sidebarFileView === 'list' && workspaceFolderNodes.length > 0 ? (
                    <div className="workspace-drag-folder-panel" role="listbox" aria-label={t('app.sidebar.dragFolderTargets')}>
                      {workspaceFolderNodes.map((folder) => {
                        const folderChrome = resolveWorkspaceFolderChrome(folder.children, false)
                        return (
                        <WorkspaceFolderDropTarget
                          key={folder.path}
                          folderPath={folder.path}
                          folderName={folder.name}
                          dragOverTarget={dragOverTarget}
                          draggingFilePath={draggingWorkspaceFile}
                          onDragOverTarget={setDragOverTarget}
                          onMoveFileToFolder={(sourcePath, destDir, isDirectory) =>
                            void handleMoveFileToFolder(sourcePath, destDir, isDirectory)
                          }
                          className={`workspace-drag-folder-row tree-folder ${folderChrome.folderClass}${isWorkspacePathDragging(draggingWorkspaceFile, folder.path) ? ' tree-folder-dragging' : ''}`}
                        >
                          <span
                            className="workspace-drag-folder-row-inner"
                            data-folder-content={folderChrome.contentState}
                            data-folder-icon={folderChrome.iconName}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return
                              onWorkspaceFilePointerDown(e, folder.path, true)
                            }}
                          >
                            <Icon name={folderChrome.iconName} size="md" className="tree-icon" tone="muted" />
                            <span className="tree-label">{folder.name}</span>
                          </span>
                        </WorkspaceFolderDropTarget>
                        )
                      })}
                    </div>
                  ) : null}
                  {sidebarFileView === 'list' ? (
                    <WorkspaceFlatList
                      files={sortedFlatWorkspaceFiles}
                      rootDir={rootDir}
                      activePath={activePath}
                      isFileSelected={isFilePathSelected}
                      onFileClick={onWorkspaceFileClick}
                      onFileContextMenu={onSidebarFileContextMenu}
                      onFilePointerDown={onWorkspaceFilePointerDown}
                      draggingFilePath={draggingWorkspaceFile}
                      dragOverTarget={dragOverTarget}
                      contextMenuFilePath={contextMenuFilePath}
                    />
                  ) : (
                    <WorkspaceTree
                      nodes={sortedFileTree}
                      depth={0}
                      rootDir={rootDir}
                      expandedDirs={expandedDirs}
                      onToggleDir={toggleWorkspaceDir}
                      activePath={activePath}
                      isFileSelected={isFilePathSelected}
                      onFileClick={onWorkspaceFileClick}
                      onFileContextMenu={onSidebarFileContextMenu}
                      dragOverTarget={dragOverTarget}
                      draggingFilePath={draggingWorkspaceFile}
                      onDragOverTarget={setDragOverTarget}
                      onMoveFileToFolder={(sourcePath, destDir, isDirectory) =>
                        void handleMoveFileToFolder(sourcePath, destDir, isDirectory)
                      }
                      onFilePointerDown={onWorkspaceFilePointerDown}
                      contextMenuFilePath={contextMenuFilePath}
                    />
                  )}
                  {!isSidebarFiltering && sidebarListMode === 'files' ? (
                    <SidebarWorkspaceOnboarding t={t} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </aside>
  )
}
