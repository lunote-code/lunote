import { type CSSProperties, type Dispatch, type MouseEvent, type SetStateAction, useEffect, useRef, useState } from 'react'
import { Icon } from '../../design-system/icons'
import { EmptyState } from '../../design-system/EmptyState'
import { DocumentOutlineBlock } from './DocumentOutlineBlock'
import { SidebarHeaderToolbar } from './SidebarHeaderChrome'
import { NoteCalendarPanel } from './NoteCalendarPanel'
import {
  isCalendarPanelView,
  isOutlinePanelView,
  sidebarFileViewFromPanelView,
  sidebarListModeFromPanelView,
  type SidebarPanelView,
} from '../workspace/sidebarPanelView'
import { useEditorUiChromeSettings } from '../hooks/useEditorUiChromeSettings'
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
import { bindOverlayScrollbarReveal } from '../overlayScrollbarReveal'

import type { TranslateFn } from '../../i18n'

export type AppSidebarPanelProps = {
  t: TranslateFn
  locale?: string
  rootDir: string
  activePath: string
  mainPaneMode?: 'visual' | 'source'
  knowledgeRailVisible?: boolean
  onOpenKnowledgePanel?: () => void
  onToggleMainPaneMode?: () => void
  searchText: string
  setSearchText: Dispatch<SetStateAction<string>>
  isSidebarFiltering: boolean
  sidebarFilterMatchCount: number
  sidebarPanelView: SidebarPanelView
  setSidebarPanelView: Dispatch<SetStateAction<SidebarPanelView>>
  draggingWorkspaceFile: string[] | null
  dragOverTarget: WorkspaceDragTarget | null
  setDragOverTarget: Dispatch<SetStateAction<WorkspaceDragTarget | null>>
  onSidebarBlankContextMenu: (e: MouseEvent) => void
  onSidebarFileContextMenu: (e: MouseEvent, path: string) => void
  outlineHeadings: TocHeading[]
  activeOutlineId: string | null
  scrollPreviewToHeading: (id: string) => void
  fileTree: FsTreeNode[]
  workspaceFolderNodes: FsTreeNode[]
  sortedFlatWorkspaceFiles: FlatWorkspaceFile[]
  noteCalendarEdits?: ReadonlyMap<string, number>
  noteCalendarPreferPersistedOnly?: boolean
  sortedFileTree: FsTreeNode[]
  expandedDirs: Set<string>
  toggleWorkspaceDir: (path: string) => void
  isFilePathSelected: (path: string) => boolean
  onWorkspaceFileClick: (e: MouseEvent, path: string) => void
  onWorkspaceFilePointerDown: (e: React.PointerEvent, path: string, isDirectory?: boolean) => void
  handleMoveFileToFolder: (sourcePath: string | string[], destDir: string, isDirectory?: boolean) => void | Promise<void>
  createNewNote: () => void | Promise<void>
  createNewNoteFromTemplate: () => void | Promise<void>
  createNewFolder: () => void | Promise<void>
  workspaceFolderName: string
  workspaceMenuRef: React.RefObject<HTMLDivElement | null>
  workspaceMenuPopRef: React.RefObject<HTMLDivElement | null>
  workspaceMenuOpen: boolean
  setWorkspaceMenuOpen: Dispatch<SetStateAction<boolean>>
  workspaceMenuPopStyle: CSSProperties | null
  fileSortMode: FileSortMode
  setFileSortMode: Dispatch<SetStateAction<FileSortMode>>
  setStatus: (msg: string) => void
  chooseFolder: () => void | Promise<void>
  refreshFileTree: () => void | Promise<void>
  /** Sidebar accessibility status line (sr-only alongside search box)*/
  sidebarStatusLine: string
  /** Path highlighted while its file context menu is open. */
  contextMenuFilePath?: string | null
}

export function AppSidebarPanel(props: AppSidebarPanelProps) {
  const {
    t,
    locale = 'en-US',
    rootDir,
    activePath,
    mainPaneMode = 'visual',
    knowledgeRailVisible = false,
    onOpenKnowledgePanel,
    onToggleMainPaneMode,
    searchText,
    setSearchText,
    isSidebarFiltering,
    sidebarFilterMatchCount,
    sidebarPanelView,
    draggingWorkspaceFile,
    dragOverTarget,
    setDragOverTarget,
    onSidebarBlankContextMenu,
    onSidebarFileContextMenu,
    outlineHeadings,
    activeOutlineId,
    scrollPreviewToHeading,
    fileTree,
    setSidebarPanelView,
    workspaceFolderNodes,
    sortedFlatWorkspaceFiles,
    noteCalendarEdits,
    noteCalendarPreferPersistedOnly = false,
    sortedFileTree,
    expandedDirs,
    toggleWorkspaceDir,
    isFilePathSelected,
    onWorkspaceFileClick,
    onWorkspaceFilePointerDown,
    handleMoveFileToFolder,
    createNewNote,
    createNewNoteFromTemplate,
    createNewFolder,
    workspaceFolderName,
    workspaceMenuRef,
    workspaceMenuPopRef,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    workspaceMenuPopStyle,
    fileSortMode,
    setFileSortMode,
    setStatus,
    chooseFolder,
    refreshFileTree,
    sidebarStatusLine,
    contextMenuFilePath = null,
  } = props

  const { noteCalendarButtonEnabled } = useEditorUiChromeSettings()
  const sidebarListMode = sidebarListModeFromPanelView(sidebarPanelView)
  const sidebarFileView = sidebarFileViewFromPanelView(sidebarPanelView)
  const showOutlinePanel = isOutlinePanelView(sidebarPanelView) && Boolean(activePath)
  const showCalendarPanel = isCalendarPanelView(sidebarPanelView)
  const showOutlineOnly = showOutlinePanel && !isSidebarFiltering && !showCalendarPanel
  const showOutlineAlongsideFilter = showOutlinePanel && isSidebarFiltering
  const filterHasNoMatches =
    isSidebarFiltering &&
    sortedFileTree.length === 0 &&
    sortedFlatWorkspaceFiles.length === 0
  const filesViewDisabled = !rootDir || fileTree.length === 0
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false)
  const fileListScrollRef = useRef<HTMLDivElement | null>(null)
  const outlineScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (searchText.trim()) setSidebarSearchOpen(true)
  }, [searchText])

  useEffect(() => {
    if (showCalendarPanel && sidebarSearchOpen) {
      setSidebarSearchOpen(false)
    }
  }, [showCalendarPanel, sidebarSearchOpen])

  useEffect(() => {
    if (showOutlineOnly) return
    if (!fileListScrollRef.current) return
    return bindOverlayScrollbarReveal(fileListScrollRef.current)
  }, [showOutlineOnly])

  useEffect(() => {
    if (!showOutlinePanel) return
    if (!outlineScrollRef.current) return
    return bindOverlayScrollbarReveal(outlineScrollRef.current)
  }, [showOutlinePanel])

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

  const renderOutlinePanel = () => (
    <div className="sidebar-list-outline-panel">
      <div className="sidebar-outline-header">{t('app.sidebar.outlineHeader')}</div>
      <div
        ref={outlineScrollRef}
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
  )

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
                  <SidebarHeaderToolbar
                    t={t}
                    view={sidebarPanelView}
                    filesDisabled={filesViewDisabled}
                    noteCalendarButtonEnabled={noteCalendarButtonEnabled}
                    onSelectView={setSidebarPanelView}
                    showSearchToggle={!showCalendarPanel}
                    searchToggle={
                      <SidebarSearchToggleButton
                        t={t}
                        rootDir={rootDir}
                        open={sidebarSearchOpen}
                        isFiltering={isSidebarFiltering}
                        onToggle={toggleSidebarSearch}
                      />
                    }
                    workspaceMenu={
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
                        createNewFolder={createNewFolder}
                        chooseFolder={chooseFolder}
                        refreshFileTree={refreshFileTree}
                        setStatus={setStatus}
                      />
                    }
                  />
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
              ref={fileListScrollRef}
              className={`file-list${
                showOutlineOnly || showCalendarPanel ? ' file-list--outline-root' : ''
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
                </div>
              ) : showCalendarPanel ? (
                <NoteCalendarPanel
                  t={t}
                  locale={locale}
                  rootDir={rootDir}
                  activePath={activePath}
                  workspaceFiles={sortedFlatWorkspaceFiles}
                  noteCalendarEdits={noteCalendarEdits}
                  noteCalendarPreferPersistedOnly={noteCalendarPreferPersistedOnly}
                  onOpenNote={(path) =>
                    onWorkspaceFileClick(
                      { shiftKey: false, metaKey: false, ctrlKey: false } as MouseEvent,
                      path,
                    )
                  }
                />
              ) : filterHasNoMatches ? (
                <>
                  <div className="sidebar-inline-empty">
                    <EmptyState variant="compact" icon="search" title={t('app.sidebar.search.filterEmpty')} />
                  </div>
                  {showOutlineAlongsideFilter ? renderOutlinePanel() : null}
                </>
              ) : showOutlineOnly ? (
                renderOutlinePanel()
              ) : sidebarListMode === 'outline' && !activePath ? (
                <div className="sidebar-inline-empty">
                  <EmptyState variant="compact" icon="note" title={t('app.sidebar.empty.openNoteOutline')} />
                </div>
              ) : fileTree.length === 0 ? (
                <>
                  <div className="sidebar-inline-empty">
                    <EmptyState variant="compact" icon="workspace" title={t('app.sidebar.empty.dirEmpty')} />
                  </div>
                  <SidebarWorkspaceOnboarding
                    t={t}
                    workspaceReady
                    mainPaneMode={mainPaneMode}
                    knowledgeRailVisible={knowledgeRailVisible}
                    onOpenKnowledgePanel={onOpenKnowledgePanel}
                    onToggleMainPaneMode={onToggleMainPaneMode}
                  />
                </>
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
                    <SidebarWorkspaceOnboarding
                      t={t}
                      workspaceReady
                      mainPaneMode={mainPaneMode}
                      knowledgeRailVisible={knowledgeRailVisible}
                      onOpenKnowledgePanel={onOpenKnowledgePanel}
                      onToggleMainPaneMode={onToggleMainPaneMode}
                    />
                  ) : null}
                  {showOutlineAlongsideFilter ? renderOutlinePanel() : null}
                </>
              )}
            </div>
          </div>
        </aside>
  )
}
