import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import {
  absolutePathToDocKeyOs,
  initKnowledgeOS,
  onKnowledgeOSWorkspaceOpened,
  openNoteInWorkspace,
  refreshBacklinkPanel,
  setBacklinkPanelDocKey,
  syncNoteGraphTopologyFromRoute,
  getNoteGraphTopology,
} from '../editor/knowledgeOS/index'
import { getGraphViewport } from '../editor/knowledgeOS/graphViewportRuntime'
import { requestOsRevision } from '../editor/knowledgeOS/knowledgeUIBridge'
import { setPendingGraphCenter } from '../editor/knowledgeOS/graphNavigationRuntime'
import { KnowledgeRightRail } from '../editor/knowledgeOS/ui/KnowledgeRightRail'
import { KnowledgeSurfaceSplitHandle } from '../editor/knowledgeOS/ui/KnowledgeSurfaceSplitHandle'
import { registerKnowledgeInteractionHost } from '../editor/knowledgeOS/ui/knowledgeInteractionHost'
import {
  bootstrapWorkspaceLinkGraphIndex,
  openVault,
  resetKnowledgeRuntime,
  waitForLinkIndexReady,
} from '../editor/knowledgeRuntime'
import type { AbsoluteDocPath } from '../editor/knowledgeRuntime/types'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import { installNavigationRuntimeFirewall } from '../navigation/navigationRuntimeFirewall'
import { pathsEqual } from '../lib/workspacePathUtils'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import { EditorTabBar } from './components/EditorTabBar'
import { useWorkspaceSidebar } from './hooks/useWorkspaceSidebar'
import { createQaKnowledgeFrontmatterUpdater } from './qa/createQaKnowledgeFrontmatterUpdater'
import {
  cloneQaKnowledgeFixtures,
  QA_KNOWLEDGE_FIXTURES,
  QA_KNOWLEDGE_ROOT,
  qaKnowledgeFixtureRelPath,
  qaKnowledgeNotePath,
} from './qa/qaKnowledgeFixtures'
import type { EditorDocMenuState, FileContextMenuState } from './workspace/contextMenuTypes'
import type { WorkspaceDragTarget } from './workspace/workspaceDrag'
import type { FileSortMode, FsTreeNode } from './workspace/types'

const QA_TREE: FsTreeNode[] = Object.keys(QA_KNOWLEDGE_FIXTURES).map((name) => ({
  name,
  path: `${QA_KNOWLEDGE_ROOT}/${name}`,
  kind: 'file' as const,
  children: [],
}))

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_APP_KNOWLEDGE__?: {
      workspaceRoot: () => string
      activePath: () => string | null
      activeDocKey: () => string | null
      openedTabPaths: () => string[]
      backlinkSourceTitles: () => string[]
      graphTopologyCenterDocKey: () => string | null
      graphViewportZoom: () => number
      writeDocumentCalls: () => string[]
      getFixtureMarkdown: (note: 'note-a' | 'note-b' | 'note-c') => string
    }
  }
}

function QaAppKnowledgeIntegrationInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('booting')
  const [rootDir] = useState(QA_KNOWLEDGE_ROOT)
  const [fileTree] = useState(QA_TREE)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState('')
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [sidebarListMode, setSidebarListMode] = useState<'files' | 'outline'>('files')
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>('tree')
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [draggingWorkspaceFile, setDraggingWorkspaceFile] = useState<string[] | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<WorkspaceDragTarget | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [, setEditorDocMenu] = useState<EditorDocMenuState | null>(null)
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null)
  const [railVisible] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fixturesRef = useRef(cloneQaKnowledgeFixtures())
  const writeDocumentCallsRef = useRef<string[]>([])
  const rootDirRef = useRef(rootDir)
  const activePathRef = useRef(activePath)
  const activeDocKeyRef = useRef<string | null>(null)
  const openedTabsRef = useRef<string[]>([])
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const fileContextMenuRef = useRef<FileContextMenuState | null>(null)

  rootDirRef.current = rootDir
  activePathRef.current = activePath
  activeDocKeyRef.current = activeDocKey
  openedTabsRef.current = openedTabs
  fileContextMenuRef.current = fileContextMenu

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const readFixture = useCallback((path: string) => {
    const rel = qaKnowledgeFixtureRelPath(path)
    const body = fixturesRef.current[rel]
    if (!body) throw new Error(`missing:${path}`)
    return body
  }, [])

  const openSearch = useCallback(() => {
    setSearchQuery('')
    setSearchOpen(true)
  }, [])

  const syncKnowledgeRoute = useCallback((docKey: string | null) => {
    setBacklinkPanelDocKey(docKey)
    if (docKey) {
      refreshBacklinkPanel(docKey)
      setPendingGraphCenter(docKey, `page:${docKey}`)
    }
    syncNoteGraphTopologyFromRoute(docKey)
    requestOsRevision()
  }, [])

  const openPathInTab = useCallback(async (path: AbsoluteDocPath, source: string) => {
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT_IN_TAB',
      root: QA_KNOWLEDGE_ROOT,
      path,
      source,
    })
  }, [])

  const dispatchOpenDocumentInTab = useCallback(
    async (root: string, path: string) => {
      if (root !== QA_KNOWLEDGE_ROOT) return
      await openPathInTab(path, 'qa-app-knowledge-sidebar')
    },
    [openPathInTab],
  )

  const activateTab = useCallback(async (path: string) => {
    if (!path) return
    await dispatchDocumentCommand({
      type: 'OPEN_DOCUMENT',
      root: QA_KNOWLEDGE_ROOT,
      path,
      source: 'qa-app-knowledge-tab',
    })
  }, [])

  const persistFixture = useCallback(async (path: string, content: string) => {
    const rel = qaKnowledgeFixtureRelPath(path)
    fixturesRef.current[rel] = content
    writeDocumentCallsRef.current.push(path)
  }, [])

  const updateDocumentFrontmatter = useMemo(
    () =>
      createQaKnowledgeFrontmatterUpdater(QA_KNOWLEDGE_ROOT, fixturesRef, {
        onPersist: async (_root, absolutePath, full) => {
          await persistFixture(absolutePath, full)
        },
      }),
    [persistFixture],
  )

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
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
    dispatchOpenDocumentInTab,
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
    window.__QA_APP_KNOWLEDGE__ = {
      workspaceRoot: () => rootDirRef.current,
      activePath: () => activePathRef.current || null,
      activeDocKey: () => activeDocKeyRef.current,
      openedTabPaths: () => [...openedTabsRef.current],
      backlinkSourceTitles: () =>
        Array.from(document.querySelectorAll('.qa-app-knowledge-rail .kos-backlink-source')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
      graphTopologyCenterDocKey: () => getNoteGraphTopology().centerDocKey,
      graphViewportZoom: () => getGraphViewport().zoom,
      writeDocumentCalls: () => [...writeDocumentCallsRef.current],
      getFixtureMarkdown: (note) => fixturesRef.current[`${note}.md`] ?? '',
    }
    return () => {
      delete window.__QA_APP_KNOWLEDGE__
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    installNavigationRuntimeFirewall()
    resetDocumentRuntimeKernel()

    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => readFixture(path),
      readDocumentForVerify: async (_root, path) => readFixture(path),
      writeDocument: async (_root, path, content) => {
        await persistFixture(path, content)
      },
      setActiveDocument: (path) => {
        const docKey = absolutePathToDocKeyOs(path, QA_KNOWLEDGE_ROOT)
        activePathRef.current = path
        setActivePath(path)
        activeDocKeyRef.current = docKey
        setActiveDocKey(docKey)
        openNoteInWorkspace(path, docKey)
        syncKnowledgeRoute(docKey)
      },
      renderContent: () => {},
      setTabs: (tabs) => {
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs(openedTabsRef.current))
      },
      onDocumentOpened: () => {},
      onDocumentSaved: () => {},
      onOpenTabLimitReached: () => {},
    })

    void (async () => {
      resetKnowledgeRuntime()
      openVault(QA_KNOWLEDGE_ROOT)
      initKnowledgeOS({
        fileAdapter: {
          read: async (path) => {
            const rel = qaKnowledgeFixtureRelPath(path)
            return fixturesRef.current[rel] ?? ''
          },
          write: async () => {},
          create: async () => {},
          delete: async () => {},
          rename: async () => {},
        },
      })
      onKnowledgeOSWorkspaceOpened(QA_KNOWLEDGE_ROOT)

      registerKnowledgeInteractionHost({
        getRootDir: () => QA_KNOWLEDGE_ROOT,
        openAbsolutePath: (absolutePath) => {
          void openPathInTab(absolutePath, 'qa-app-knowledge-host')
        },
        clearEditorSelection: () => {},
        focusEditor: () => {},
        insertWikiLinkAtCursor: () => false,
        onHoverIdChange: () => {},
        openSearchModal: openSearch,
        revealNavigationAnchor: () => {},
        updateDocumentFrontmatter,
      })

      const paths = Object.keys(fixturesRef.current).map(
        (file) => `${QA_KNOWLEDGE_ROOT}/${file}` as AbsoluteDocPath,
      )
      await bootstrapWorkspaceLinkGraphIndex(QA_KNOWLEDGE_ROOT, paths, async (path) => {
        const rel = qaKnowledgeFixtureRelPath(path)
        return fixturesRef.current[rel] ?? ''
      })

      const indexReady = await waitForLinkIndexReady(15_000)
      if (cancelled) return
      if (!indexReady) {
        setStatus('error:index-timeout')
        return
      }

      await dispatchDocumentCommand({
        type: 'RESTORE_WORKSPACE',
        root: QA_KNOWLEDGE_ROOT,
        activePath: qaKnowledgeNotePath('note-b'),
        openTabs: [qaKnowledgeNotePath('note-b')],
        source: 'qa-app-knowledge-boot',
      })
      setStatus('ready')
    })()

    return () => {
      cancelled = true
      registerKnowledgeInteractionHost(null)
      registerDocumentRuntimeCapabilities(null)
      resetDocumentRuntimeKernel()
    }
  }, [openPathInTab, openSearch, readFixture, syncKnowledgeRoute, updateDocumentFrontmatter, persistFixture])

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

  return (
    <div className="qa-app-knowledge-root">
      <div className="qa-app-knowledge-diagnostics">
        <p data-testid="qa-ready">App knowledge integration QA</p>
        <p data-testid="qa-status">{status}</p>
        <p data-testid="qa-workspace-root">{rootDir}</p>
        <p data-testid="qa-active-path">{activePath}</p>
      </div>

      <div className="layout workspace-split mod-root with-sidebar with-knowledge-rail qa-app-knowledge-layout">
        <AppSidebarPanel
          t={t}
          rootDir={rootDir}
          activePath={activePath}
          mainPaneMode="visual"
          knowledgeRailVisible={railVisible}
          onOpenKnowledgePanel={() => undefined}
          onToggleMainPaneMode={() => undefined}
          searchText={searchText}
          setSearchText={setSearchText}
          isSidebarFiltering={isSidebarFiltering}
          sidebarFilterMatchCount={sidebarFilterMatchCount}
          sidebarListMode={sidebarListMode}
          draggingWorkspaceFile={draggingWorkspaceFile}
          dragOverTarget={dragOverTarget}
          setDragOverTarget={setDragOverTarget}
          onSidebarBlankContextMenu={onSidebarBlankContextMenu}
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

        <main
          className="main main-with-rail workspace-leaf mod-active has-kos-rail"
          data-testid="qa-app-knowledge-main"
        >
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={(path) => {
              void activateTab(path)
            }}
            onClose={(path) => {
              setOpenedTabs((tabs) => tabs.filter((item) => !pathsEqual(item, path)))
              if (pathsEqual(activePath, path)) {
                const next = openedTabs.find((item) => !pathsEqual(item, path)) ?? ''
                void activateTab(next)
              }
            }}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
          />

          <div className="editor-body-surface view-content" data-testid="qa-editor-surface">
            <div
              className="preview-pane markdown-visual-editor"
              data-testid="qa-app-knowledge-editor-pane"
            >
              {activePath ? (
                <p className="qa-app-knowledge-editor-stub">Editing {tabLabel(activePath)}</p>
              ) : (
                <p className="qa-app-knowledge-editor-stub">No active document</p>
              )}
            </div>
          </div>

          <div className="qa-app-knowledge-rail-host" style={{ display: 'flex', minHeight: 0 }}>
            <KnowledgeSurfaceSplitHandle onPointerDown={() => undefined} onRailWidthChange={() => undefined} />
            <div className="qa-app-knowledge-rail kos-right-rail">
              <KnowledgeRightRail
              activeDocKey={activeDocKey}
              visible={railVisible}
              searchOpen={searchOpen}
              searchQuery={searchQuery}
              onSearchOpenChange={setSearchOpen}
              onSearchQueryChange={setSearchQuery}
              onClose={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
            />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export function QaAppKnowledgeIntegrationPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaAppKnowledgeIntegrationInner />
    </I18nProvider>
  )
}
