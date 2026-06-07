import { type CSSProperties, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { Icon } from '../../design-system/icons'
import { executeManifestCommand } from '../../menu'
import type { AppMenuContext, AppMenuUiDeps, ToolbarCommandDef } from '../../menu'
import { DocumentOutlineBlock } from './DocumentOutlineBlock'
import { SidebarRecentFiles } from './SidebarRecentFiles'
import { SidebarSearchChrome } from './SidebarSearchChrome'
import { SidebarWorkspaceEmpty } from './SidebarWorkspaceEmpty'
import { SidebarWorkspaceOnboarding } from './SidebarWorkspaceOnboarding'
import { WorkspaceFlatList, WorkspaceTree } from './WorkspaceTree'
import { WorkspaceFolderDropTarget, isWorkspacePathDragging } from '../workspace/workspaceDrag'
import { revealInExplorer } from '../../platform/tauri/platformShellService'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode } from '../workspace/types'
import type { WorkspaceDragTarget } from '../workspace/workspaceDrag'
import type { TocHeading } from './DocumentOutlineBlock'

import type { TranslateFn } from '../../i18n'

export type AppSidebarPanelProps = {
  toolbarSidebar: ToolbarCommandDef[]
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
  workspaceFolderNodes: { path: string; name: string }[]
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
  setSidebarVisible: Dispatch<SetStateAction<boolean>>
  setStatus: (msg: string) => void
  chooseFolder: () => void | Promise<void>
  toggleSidebarListOutline: () => void
  refreshFileTree: () => void | Promise<void>
  appMenuCtxRef: React.MutableRefObject<AppMenuContext>
  paletteUiDepsRef: React.MutableRefObject<AppMenuUiDeps>
  setSidebarFileView: Dispatch<SetStateAction<'tree' | 'list'>>
  recentFiles: readonly string[]
  onOpenRecent: (path: string) => void
  onClearRecent: () => void | Promise<void>
  /** Sidebar accessibility status line (sr-only alongside search box)*/
  sidebarStatusLine: string
}

export function AppSidebarPanel(props: AppSidebarPanelProps) {
  const {
    toolbarSidebar,
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
    setSidebarVisible,
    setStatus,
    chooseFolder,
    toggleSidebarListOutline,
    refreshFileTree,
    appMenuCtxRef,
    paletteUiDepsRef,
    setSidebarFileView,
    recentFiles,
    onOpenRecent,
    onClearRecent,
    sidebarStatusLine,
  } = props

  const newNoteLabel = rootDir ? t('app.sidebar.newNoteWithRoot') : t('app.sidebar.newNoteNoRoot')
  const viewToggleLabel =
    sidebarListMode === 'outline'
      ? t('app.sidebar.switchToFilesFirst')
      : sidebarFileView === 'tree'
        ? t('app.sidebar.viewList')
        : t('app.sidebar.viewTree')
  const showOutlinePanel = sidebarListMode === 'outline' && !isSidebarFiltering && activePath
  const filterHasNoMatches =
    isSidebarFiltering &&
    sortedFileTree.length === 0 &&
    sortedFlatWorkspaceFiles.length === 0

  return (
        <aside className="sidebar workspace-split mod-left-split" data-workspace-sidebar>
          <div className="sidebar-pane-top">
            <div className="sidebar-header">
              {toolbarSidebar.map((cmd) => {
                const run = () => {
                  if (cmd.id === 'open-folder') void chooseFolder()
                  else if (cmd.id === 'view-sidebar-outline') toggleSidebarListOutline()
                  else void executeManifestCommand(cmd.id, appMenuCtxRef.current, paletteUiDepsRef.current)
                }
                const isOutline = cmd.id === 'view-sidebar-outline'
                const isOpenFolder = cmd.id === 'open-folder'
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={`icon-btn ghost-btn${isOutline && sidebarListMode === 'outline' ? ' icon-btn-active' : ''}`}
                    onClick={run}
                    title={
                      isOutline
                        ? sidebarListMode === 'outline'
                          ? t('app.sidebar.toggleOutlineFiles')
                          : t('app.sidebar.toggleOutline')
                        : cmd.shortcut
                          ? `${cmd.title} (${cmd.shortcut})`
                          : cmd.title
                    }
                    aria-pressed={isOutline ? sidebarListMode === 'outline' : undefined}
                    aria-label={isOutline ? t('app.sidebar.toggleOutlineAria') : cmd.title}
                  >
                    {isOpenFolder ? (
                      <Icon name="workspace-open" size="md" />
                    ) : isOutline ? (
                      <Icon name="outline" size="md" stroke="strong" />
                    ) : null}
                  </button>
                )
              })}
              <button
                type="button"
                className="icon-btn ghost-btn"
                onClick={() => setSidebarVisible(false)}
                title={t('app.sidebar.hide')}
                aria-label={t('app.sidebar.hide')}
              >
                <Icon name="sidebar-close" size="md" />
              </button>
            </div>
            <SidebarSearchChrome
              t={t}
              rootDir={rootDir}
              searchText={searchText}
              onSearchTextChange={setSearchText}
            />
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
                      {workspaceFolderNodes.map((folder) => (
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
                          className={`workspace-drag-folder-row tree-folder${isWorkspacePathDragging(draggingWorkspaceFile, folder.path) ? ' tree-folder-dragging' : ''}`}
                        >
                          <span
                            className="workspace-drag-folder-row-inner"
                            onPointerDown={(e) => {
                              if (e.button !== 0) return
                              onWorkspaceFilePointerDown(e, folder.path, true)
                            }}
                          >
                            <Icon name="workspace" size="md" className="tree-icon" tone="muted" />
                            <span className="tree-label">{folder.name}</span>
                          </span>
                        </WorkspaceFolderDropTarget>
                      ))}
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
                    />
                  )}
                  {!isSidebarFiltering && sidebarListMode === 'files' ? (
                    <SidebarWorkspaceOnboarding t={t} />
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div className="sidebar-footer" role="toolbar" aria-label={t('app.sidebar.footer')}>
            <button
              type="button"
              className="icon-btn ghost-btn sidebar-footer-btn"
              onClick={() => void createNewNote()}
              title={newNoteLabel}
              aria-label={newNoteLabel}
            >
              <Icon name="note-new" size="lg" stroke="strong" />
            </button>
            <div className="sidebar-footer-workspace" ref={workspaceMenuRef}>
              <span className="sidebar-footer-name" title={rootDir || undefined}>
                <button
                  type="button"
                  className="sidebar-footer-name-btn"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!rootDir) return
                    setWorkspaceMenuOpen((v) => !v)
                  }}
                  title={rootDir || undefined}
                  aria-label={t('app.sidebar.workspaceMenu')}
                  aria-haspopup="menu"
                  aria-expanded={workspaceMenuOpen}
                  disabled={!rootDir}
                >
                  {workspaceFolderName}
                </button>
              </span>
              {workspaceMenuOpen && rootDir && (
              <div
                ref={workspaceMenuPopRef}
                className="workspace-menu-pop"
                role="menu"
                style={
                  workspaceMenuPopStyle ?? {
                    position: 'fixed',
                    visibility: 'hidden',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                  }
                }
                onContextMenu={(e) => e.preventDefault()}
              >
                <button
                  type="button"
                  className="file-ctx-item"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    void createNewNote()
                  }}
                >
                  {t('ctx.file.newFile')}
                </button>
                <button
                  type="button"
                  className="file-ctx-item"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    void createNewNoteFromTemplate()
                  }}
                >
                  {t('ctx.file.newFileFromTemplate')}
                </button>
                <button
                  type="button"
                  className="file-ctx-item"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    if (!isTauri()) {
                      setStatus(t('app.status.revealFolderDesktopOnly'))
                      return
                    }
                    void revealInExplorer(rootDir, rootDir)
                  }}
                >
                  {t('app.sidebar.revealInFolder')}
                </button>
                <button
                  type="button"
                  className="file-ctx-item"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    void chooseFolder()
                  }}
                >
                  {t('app.sidebar.openFolderBtn')}
                </button>
                <button
                  type="button"
                  className="file-ctx-item"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    void (async () => {
                      await refreshFileTree()
                      await refreshWorkspaceIndex(rootDir)
                      setStatus(t('app.status.refreshed'))
                    })()
                  }}
                >
                  <Icon name="refresh" size="sm" />
                  {t('app.sidebar.refreshBtn')}
                </button>
                <div className="file-ctx-sep" role="separator" />
                <div className="workspace-sort-row" aria-label={t('app.sidebar.sortRow')}>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'group' ? ' active' : ''}`}
                    title={t('app.sort.groupByFolder')}
                    aria-label={t('app.sort.groupByFolder')}
                    onClick={() => setFileSortMode('group')}
                  >
                    <Icon name="workspace-tree" size="md" />
                    <span className="workspace-sort-btn-label">{t('app.sort.groupShort')}</span>
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'naturalAsc' ? ' active' : ''}`}
                    title={t('app.sort.naturalAsc')}
                    aria-label={t('app.sort.naturalAsc')}
                    onClick={() => setFileSortMode('naturalAsc')}
                  >
                    <Icon name="sort-az" size="md" />
                    <span className="workspace-sort-btn-label">{t('app.sort.naturalAscShort')}</span>
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'nameAsc' ? ' active' : ''}`}
                    title={t('app.sort.nameAsc')}
                    aria-label={t('app.sort.nameAsc')}
                    onClick={() => setFileSortMode('nameAsc')}
                  >
                    <Icon name="sort-za" size="md" />
                    <span className="workspace-sort-btn-label">{t('app.sort.nameAscShort')}</span>
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'modifiedAsc' ? ' active' : ''}`}
                    title={t('app.sort.modifiedAsc')}
                    aria-label={t('app.sort.modifiedAsc')}
                    onClick={() => setFileSortMode('modifiedAsc')}
                  >
                    <Icon name="sort-time" size="md" />
                    <span className="workspace-sort-btn-label">{t('app.sort.modifiedAscShort')}</span>
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'createdAsc' ? ' active' : ''}`}
                    title={t('app.sort.createdAsc')}
                    aria-label={t('app.sort.createdAsc')}
                    onClick={() => setFileSortMode('createdAsc')}
                  >
                    <Icon name="sort-created" size="md" />
                    <span className="workspace-sort-btn-label">{t('app.sort.createdAscShort')}</span>
                  </button>
                </div>
              </div>
              )}
            </div>
            <button
              type="button"
              className="icon-btn ghost-btn sidebar-footer-btn"
              onClick={() => setSidebarFileView((v) => (v === 'tree' ? 'list' : 'tree'))}
              disabled={!rootDir || fileTree.length === 0 || sidebarListMode === 'outline'}
              title={viewToggleLabel}
              aria-label={viewToggleLabel}
            >
              {sidebarFileView === 'tree' ? (
                <Icon name="list" size="lg" stroke="strong" />
              ) : (
                <Icon name="workspace-tree" size="lg" stroke="strong" />
              )}
            </button>
          </div>
        </aside>
  )
}
