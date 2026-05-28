import { useMemo, type CSSProperties, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { Icon } from '../../design-system/icons'
import {
  executeManifestCommand,
  formatAcceleratorForDisplay,
  getManifestDefaultAccelerator,
} from '../../menu'
import type { AppMenuContext, AppMenuUiDeps, ToolbarCommandDef } from '../../menu'
import { DocumentOutlineBlock } from './DocumentOutlineBlock'
import { WorkspaceFlatList, WorkspaceTree } from './WorkspaceTree'
import { WorkspaceFolderDropTarget } from '../workspace/workspaceDrag'
import { safeSearchSnippetHtml } from '../search/searchSnippet'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { preventButtonSecondaryMouseDown } from './preventButtonSecondaryMouseDown'
import { revealInExplorer } from '../../platform/tauri/platformShellService'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode, SearchResult } from '../workspace/types'
import type { WorkspaceDragTarget } from '../workspace/workspaceDrag'
import type { TocHeading } from './DocumentOutlineBlock'

import type { TranslateFn } from '../../i18n'

export type AppSidebarPanelProps = {
  toolbarSidebar: ToolbarCommandDef[]
  t: TranslateFn
  rootDir: string
  activePath: string
  mainPaneMode: 'visual' | 'source'
  searchText: string
  setSearchText: Dispatch<SetStateAction<string>>
  setSearchResults: Dispatch<SetStateAction<SearchResult[]>>
  searchResults: SearchResult[]
  sidebarListMode: 'files' | 'outline'
  draggingWorkspaceFile: string | null
  dragOverTarget: WorkspaceDragTarget | null
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  onSidebarBlankContextMenu: (e: MouseEvent) => void
  dispatchOpenDocument: (root: string, path: string) => void | Promise<void>
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
  openWorkspaceFileFromSidebar: (path: string) => void
  onWorkspaceFilePointerDown: (e: React.PointerEvent, path: string) => void
  handleMoveFileToFolder: (filePath: string, destDir: string) => void | Promise<void>
  createNewNote: () => void | Promise<void>
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
  toggleMainPaneMode: () => void
  refreshFileTree: () => void | Promise<void>
  appMenuCtxRef: React.MutableRefObject<AppMenuContext>
  paletteUiDepsRef: React.MutableRefObject<AppMenuUiDeps>
  setSidebarFileView: Dispatch<SetStateAction<'tree' | 'list'>>
  /** Sidebar accessibility status line (sr-only alongside search box)*/
  sidebarStatusLine: string
}

export function AppSidebarPanel(props: AppSidebarPanelProps) {
  const {
    toolbarSidebar,
    t,
    rootDir,
    activePath,
    mainPaneMode,
    searchText,
    setSearchText,
    setSearchResults,
    searchResults,
    sidebarListMode,
    draggingWorkspaceFile,
    dragOverTarget,
    setDragOverTarget,
    onSidebarBlankContextMenu,
    dispatchOpenDocument,
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
    openWorkspaceFileFromSidebar,
    onWorkspaceFilePointerDown,
    handleMoveFileToFolder,
    createNewNote,
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
    toggleMainPaneMode,
    refreshFileTree,
    appMenuCtxRef,
    paletteUiDepsRef,
    setSidebarFileView,
    sidebarStatusLine,
  } = props

  const searchPlaceholder = useMemo(
    () =>
      t('app.search.placeholder', {
        globalSearch: formatAcceleratorForDisplay(getManifestDefaultAccelerator('view-search') ?? 'Mod+Shift+f'),
        commandPalette: formatAcceleratorForDisplay(getManifestDefaultAccelerator('command-palette-open') ?? 'Mod+Shift+p'),
        findInDoc: formatAcceleratorForDisplay(getManifestDefaultAccelerator('edit-find') ?? 'Mod+f'),
      }),
    [t],
  )

  return (
        <aside className="sidebar workspace-split mod-left-split">
          <div className="sidebar-pane-top">
            <div className="sidebar-header">
              {toolbarSidebar.map((cmd) => {
                const run = () => {
                  if (cmd.id === 'open-folder') void chooseFolder()
                  else if (cmd.id === 'toggle-source-mode') toggleMainPaneMode()
                  else void executeManifestCommand(cmd.id, appMenuCtxRef.current, paletteUiDepsRef.current)
                }
                const isMode = cmd.id === 'toggle-source-mode'
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={cmd.id === 'open-folder' ? 'icon-btn primary-btn' : 'icon-btn ghost-btn'}
                    onClick={run}
                    title={cmd.shortcut ? `${cmd.title} (${cmd.shortcut})` : cmd.title}
                    aria-pressed={isMode ? mainPaneMode === 'source' : undefined}
                    aria-label={cmd.title}
                  >
                    {cmd.id === 'open-folder' ? (
                      <Icon name="workspace-open" size="md" tone="inverse" />
                    ) : mainPaneMode === 'source' ? (
                      <Icon name="preview" size="md" />
                    ) : (
                      <Icon name="source" size="md" />
                    )}
                  </button>
                )
              })}
              <button
                className="icon-btn ghost-btn"
                onClick={() => setSidebarVisible(false)}
                title={t('app.sidebar.hide')}
              >
                <Icon name="sidebar-close" size="md" />
              </button>
            </div>
            <div className="sidebar-chrome-tabs-row">
              <input
                id="search-input"
                value={searchText}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchText(value)
                  if (!value.trim()) {
                    setSearchResults([])
                  }
                }}
                className="search-input"
                placeholder={searchPlaceholder}
              />
            </div>
            <span className="sr-only" aria-live="polite">
              {sidebarStatusLine}
            </span>
          </div>
          <div className="sidebar-scroll">
            <div
              className={`file-list${
                sidebarListMode === 'outline' && !(searchText && searchResults.length > 0) ? ' file-list--outline-root' : ''
              }${draggingWorkspaceFile ? ' file-list--workspace-drag' : ''}${dragOverTarget?.kind === 'root' ? ' file-list--root-drop-target' : ''}`}
              data-workspace-root-drop={rootDir ? rootDir.replace(/[/\\]+$/u, '') : undefined}
              onContextMenu={onSidebarBlankContextMenu}
            >
              {searchText && searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={`search-${item.path}`}
                    className={`note-item ${pathsEqual(activePath, item.path) ? 'active' : ''}`}
                    onClick={() => void dispatchOpenDocument(rootDir, item.path)}
                    onMouseDown={preventButtonSecondaryMouseDown}
                    onContextMenu={(e) => {
                      if (!rootDir) return
                      e.preventDefault()
                      e.stopPropagation()
                      onSidebarFileContextMenu(e, item.path)
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span dangerouslySetInnerHTML={{ __html: safeSearchSnippetHtml(item.snippet) }} />
                  </button>
                ))
              ) : !rootDir ? (
                <p className="file-list-empty">{t('app.sidebar.empty.openFolder')}</p>
              ) : sidebarListMode === 'outline' ? (
                activePath ? (
                  <div className="sidebar-list-outline-panel">
                    <div className="sidebar-outline-header">{t('app.sidebar.outlineHeader')}</div>
                    <div
                      className="sidebar-outline-scroll"
                      onMouseDown={(e) => {
                        const t = e.target
                        if (t instanceof Element && t.closest('.document-outline-link, .document-outline-chevron')) {
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
                ) : (
                  <p className="file-list-empty">{t('app.sidebar.empty.openNoteOutline')}</p>
                )
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
                          onMoveFileToFolder={(filePath, destDir) => void handleMoveFileToFolder(filePath, destDir)}
                          className="workspace-drag-folder-row tree-folder"
                        >
                          <Icon name="workspace" size="md" className="tree-icon" tone="muted" />
                          <span className="tree-label">{folder.name}</span>
                        </WorkspaceFolderDropTarget>
                      ))}
                    </div>
                  ) : null}
                  {sidebarFileView === 'list' ? (
                    <WorkspaceFlatList
                      files={sortedFlatWorkspaceFiles}
                      rootDir={rootDir}
                      activePath={activePath}
                      onOpenFile={openWorkspaceFileFromSidebar}
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
                      onOpenFile={openWorkspaceFileFromSidebar}
                      onFileContextMenu={onSidebarFileContextMenu}
                      dragOverTarget={dragOverTarget}
                      draggingFilePath={draggingWorkspaceFile}
                      onDragOverTarget={setDragOverTarget}
                      onMoveFileToFolder={(filePath, destDir) => void handleMoveFileToFolder(filePath, destDir)}
                      onFilePointerDown={onWorkspaceFilePointerDown}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="sidebar-footer" role="toolbar" aria-label={t('app.sidebar.footer')}>
            <button
              type="button"
              className="icon-btn ghost-btn sidebar-footer-btn"
              onClick={() => void createNewNote()}
              title={rootDir ? t('app.sidebar.newNoteWithRoot') : t('app.sidebar.newNoteNoRoot')}
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
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'naturalAsc' ? ' active' : ''}`}
                    title={t('app.sort.naturalAsc')}
                    aria-label={t('app.sort.naturalAsc')}
                    onClick={() => setFileSortMode('naturalAsc')}
                  >
                    <Icon name="sort-az" size="md" />
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'nameAsc' ? ' active' : ''}`}
                    title={t('app.sort.nameAsc')}
                    aria-label={t('app.sort.nameAsc')}
                    onClick={() => setFileSortMode('nameAsc')}
                  >
                    <Icon name="sort-za" size="md" />
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'modifiedAsc' ? ' active' : ''}`}
                    title={t('app.sort.modifiedAsc')}
                    aria-label={t('app.sort.modifiedAsc')}
                    onClick={() => setFileSortMode('modifiedAsc')}
                  >
                    <Icon name="sort-time" size="md" />
                  </button>
                  <button
                    type="button"
                    className={`workspace-sort-btn${fileSortMode === 'createdAsc' ? ' active' : ''}`}
                    title={t('app.sort.createdAsc')}
                    aria-label={t('app.sort.createdAsc')}
                    onClick={() => setFileSortMode('createdAsc')}
                  >
                    <Icon name="sort-created" size="md" />
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
              title={
                sidebarListMode === 'outline'
                  ? t('app.sidebar.switchToFilesFirst')
                  : sidebarFileView === 'tree'
                    ? t('app.sidebar.viewList')
                    : t('app.sidebar.viewTree')
              }
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
