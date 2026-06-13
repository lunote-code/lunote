import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { pathsEqual } from '../lib/workspacePathUtils'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import { EditorTabBar } from './components/EditorTabBar'
import { useWorkspaceSidebar } from './hooks/useWorkspaceSidebar'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { FileSortMode, FsTreeNode } from './workspace/types'

const QA_ROOT = '/qa-vault'
const QA_DOC_A = `${QA_ROOT}/doc-a.md`
const QA_DOC_B = `${QA_ROOT}/doc-b.md`
const QA_DOC_C = `${QA_ROOT}/notes/doc-c.md`

const QA_TREE: FsTreeNode[] = [
  {
    name: 'doc-a.md',
    path: QA_DOC_A,
    kind: 'file',
    children: [],
  },
  {
    name: 'notes',
    path: `${QA_ROOT}/notes`,
    kind: 'dir',
    children: [
      {
        name: 'doc-c.md',
        path: QA_DOC_C,
        kind: 'file',
        children: [],
      },
    ],
  },
  {
    name: 'doc-b.md',
    path: QA_DOC_B,
    kind: 'file',
    children: [],
  },
]

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_WORKSPACE_SIDEBAR_SELECTION__?: {
      getActivePath: () => string
      getSelectedPaths: () => string[]
      countSidebarSelectedItems: () => number
      countSidebarActiveItems: () => number
      countSidebarContextTargetItems: () => number
      getContextMenuPath: () => string | null
      activateTab: (path: string) => void
      clickSidebarFile: (path: string) => void
    }
  }
}

function QaWorkspaceSidebarSelectionInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('ready')
  const [rootDir] = useState(QA_ROOT)
  const [fileTree] = useState(QA_TREE)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set([`${QA_ROOT}/notes`]))
  const [openedTabs, setOpenedTabs] = useState<string[]>([QA_DOC_A, QA_DOC_B])
  const [activePath, setActivePath] = useState(QA_DOC_A)
  const [searchText, setSearchText] = useState('')
  const [sidebarListMode, setSidebarListMode] = useState<'files' | 'outline'>('files')
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>('tree')
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [draggingWorkspaceFile, setDraggingWorkspaceFile] = useState<string[] | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<WorkspaceDragTarget | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [, setEditorDocMenu] = useState<EditorDocMenuState | null>(null)
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null)
  const fileContextMenuRef = useRef<FileContextMenuState | null>(null)

  const rootDirRef = useRef(rootDir)
  const activePathRef = useRef(activePath)
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)

  rootDirRef.current = rootDir
  activePathRef.current = activePath
  fileContextMenuRef.current = fileContextMenu

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const dispatchOpenDocument = useCallback(async (root: string, path: string) => {
    if (root !== QA_ROOT) return
    setOpenedTabs((tabs) => (tabs.some((item) => pathsEqual(item, path)) ? tabs : [...tabs, path]))
    setActivePath(path)
    setStatus(`opened:${path.split('/').pop() ?? path}`)
  }, [])

  const {
    sortedFlatWorkspaceFiles,
    sortedFileTree,
    workspaceFolderNodes,
    sidebarFilterMatchCount,
    isSidebarFiltering,
    toggleWorkspaceDir,
    onWorkspaceFilePointerDown,
    onSidebarFileContextMenu,
    onSidebarBlankContextMenu,
    isFilePathSelected,
    handleWorkspaceFileClick,
    selectedFilePaths,
  } = useWorkspaceSidebar({
    t,
    rootDir,
    rootDirRef,
    activePath,
    fileTree,
    fileSortMode,
    searchText,
    sidebarListMode,
    sidebarFileView,
    expandedDirs,
    draggingWorkspaceFile,
    setDraggingWorkspaceFile,
    dragOverTarget,
    setDragOverTarget,
    setEditorDocMenu,
    setFileContextMenu,
    dispatchOpenDocument,
    handleMoveFileToFolder: async () => undefined,
    toggleDir,
    setExpandedDirs,
    tabLabel,
    setStatus,
  })

  const onWorkspaceFileClick = useCallback(
    (e: ReactMouseEvent, path: string) => {
      handleWorkspaceFileClick(path, {
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
      })
    },
    [handleWorkspaceFileClick],
  )

  const workspaceMenuPopStyle = useMemo(
    () =>
      workspaceMenuOpen
        ? ({
            position: 'fixed',
            left: 180,
            top: 48,
            visibility: 'visible',
          } as const)
        : null,
    [workspaceMenuOpen],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    if (!fileContextMenu) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return
      setFileContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileContextMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [fileContextMenu])

  useEffect(() => {
    window.__QA_WORKSPACE_SIDEBAR_SELECTION__ = {
      getActivePath: () => activePathRef.current,
      getSelectedPaths: () => [...selectedFilePaths],
      countSidebarSelectedItems: () => document.querySelectorAll('.note-item.is-selected').length,
      countSidebarActiveItems: () => document.querySelectorAll('.note-item.active').length,
      countSidebarContextTargetItems: () =>
        document.querySelectorAll('.note-item.is-context-target, .tree-folder.is-context-target').length,
      getContextMenuPath: () => fileContextMenuRef.current?.path ?? null,
      activateTab: (path: string) => {
        setActivePath(path)
        setStatus(`tab:${path.split('/').pop() ?? path}`)
      },
      clickSidebarFile: (path: string) => {
        handleWorkspaceFileClick(path, { shiftKey: false, metaKey: false, ctrlKey: false })
      },
    }
    return () => {
      delete window.__QA_WORKSPACE_SIDEBAR_SELECTION__
    }
  }, [handleWorkspaceFileClick, selectedFilePaths])

  return (
    <div className="qa-workspace-sidebar-selection-root">
      <p data-testid="qa-ready">Workspace sidebar selection QA</p>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-active-path">{activePath}</p>
      <p data-testid="qa-selected-paths">{selectedFilePaths.join('|')}</p>

      <div className="layout workspace-split mod-root qa-workspace-sidebar-selection-layout with-sidebar">
        <AppSidebarPanel
          t={t}
          rootDir={rootDir}
          activePath={activePath}
          searchText={searchText}
          setSearchText={setSearchText}
          isSidebarFiltering={isSidebarFiltering}
          sidebarFilterMatchCount={sidebarFilterMatchCount}
          sidebarListMode={sidebarListMode}
          draggingWorkspaceFile={draggingWorkspaceFile}
          dragOverTarget={dragOverTarget}
          setDragOverTarget={setDragOverTarget}
          onSidebarBlankContextMenu={onSidebarBlankContextMenu}
          dispatchOpenDocument={dispatchOpenDocument}
          onSidebarFileContextMenu={onSidebarFileContextMenu}
          outlineHeadings={[]}
          activeOutlineId={null}
          scrollPreviewToHeading={() => undefined}
          fileTree={fileTree}
          sidebarFileView={sidebarFileView}
          setSidebarFileView={setSidebarFileView}
          workspaceFolderNodes={workspaceFolderNodes}
          sortedFlatWorkspaceFiles={sortedFlatWorkspaceFiles}
          sortedFileTree={sortedFileTree}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={toggleWorkspaceDir}
          isFilePathSelected={isFilePathSelected}
          onWorkspaceFileClick={onWorkspaceFileClick}
          onWorkspaceFilePointerDown={onWorkspaceFilePointerDown}
          handleMoveFileToFolder={async () => undefined}
          createNewNote={() => undefined}
          createNewNoteFromTemplate={() => undefined}
          workspaceFolderName="qa-vault"
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setSidebarListMode={setSidebarListMode}
          setStatus={setStatus}
          chooseFolder={() => undefined}
          refreshFileTree={async () => undefined}
          recentFiles={[]}
          onOpenRecent={() => undefined}
          onClearRecent={async () => undefined}
          sidebarStatusLine=""
          contextMenuFilePath={fileContextMenu?.path ?? null}
        />

        <main className="main main-with-rail workspace-leaf mod-active">
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={setActivePath}
            onClose={() => undefined}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
          />
        </main>
      </div>
    </div>
  )
}

export function QaWorkspaceSidebarSelectionPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaWorkspaceSidebarSelectionInner />
    </I18nProvider>
  )
}
